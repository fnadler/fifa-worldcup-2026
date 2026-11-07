import "server-only";
import type { User } from "@supabase/supabase-js";
import { getCatalog } from "./catalog";
import { emailConfigured, sendEmail } from "./email/resend";
import { shopMatchHtml, shopMatchSubject, shopMatchText, type ShopMatchEmailInput } from "./email/shopMatch";
import { matchShops } from "./shopMatch";
import { fetchAll } from "./fetchAll";
import { firstNameOf as firstName, findUserByEmail as findUser, listAllUsers, pause } from "./emailRecipients";
import { createAdminClient } from "./supabase/admin";
import { userCollections } from "./userCollections";

// "Lojas com o que falta na sua coleção" por e-mail: o teste para UMA conta (não conta como envio) e o
// envio em lote para quem marcou bastante coisa e não tem loja ligada. O lote é único por conta: a data
// do envio fica em app_metadata (só o servidor escreve), e quem já recebeu fica de fora.

const LOJAS_POR_COLECAO = 3;

/** O conteúdo do e-mail de uma conta: as coleções dela em que alguma loja tem o que falta. */
export async function shopMatchInputFor(user: User): Promise<ShopMatchEmailInput> {
  const colecoes = await userCollections(createAdminClient(), user.id);
  const collections: ShopMatchEmailInput["collections"] = [];
  const todas = new Set<string>();
  for (const col of colecoes) {
    const r = await matchShops(user.id, col.albumId);
    if (!r.shops.length) continue;
    for (const s of r.shops) todas.add(s.path);
    collections.push({
      name: getCatalog(col.albumId).shortName,
      slug: r.slug,
      missing: r.missing,
      categories: r.categories.filter((c) => c.missing > 0).map(({ key, label }) => ({ key, label })),
      shops: r.shops.slice(0, LOJAS_POR_COLECAO),
      totalShops: r.shops.length,
      fullShops: r.shops.filter((s) => s.matched >= s.missing).length,
    });
  }
  return { firstName: firstName(user), collections, shopCount: todas.size };
}

export type ShopMatchPreview =
  | { status: "nao-encontrado" | "sem-lojas" }
  | { status: "ok"; subject: string; html: string; text: string; to: string };

export async function previewShopMatchEmail(email: string): Promise<ShopMatchPreview> {
  const user = await findUser(email);
  if (!user?.email) return { status: "nao-encontrado" };
  const input = await shopMatchInputFor(user);
  if (!input.collections.length) return { status: "sem-lojas" };
  return { status: "ok", to: user.email, subject: shopMatchSubject(input), html: shopMatchHtml(input), text: shopMatchText(input) };
}

/** Envia o e-mail a uma conta só (teste do modelo). */
export async function sendShopMatchEmailTo(email: string): Promise<{ status: string; id?: string }> {
  if (!emailConfigured()) return { status: "desligado" };
  const p = await previewShopMatchEmail(email);
  if (p.status !== "ok") return p;
  const id = await sendEmail({ to: p.to, subject: p.subject, html: p.html, text: p.text });
  return { status: "enviado", id };
}

/** Chave em app_metadata com a data do envio em lote. */
const SENT_KEY = "email_lojas_com_o_que_falta_em";

export interface ShopMatchSweepOptions {
  /** Mínimo de itens marcados (somando as coleções) — padrão 100. */
  minItems?: number;
  /** Só conta e monta, sem enviar. */
  dryRun?: boolean;
}

/** Envio em lote: e-mail confirmado, mais de minItems itens, sem loja ligada, que ainda não recebeu. */
export async function sweepShopMatchEmails({ minItems = 100, dryRun }: ShopMatchSweepOptions) {
  const admin = createAdminClient();

  const users = await listAllUsers();

  const [{ data: rows, error }, { data: shops }] = await Promise.all([
    fetchAll<{ user_id: string }>((from, to) =>
      admin.from("collection").select("user_id").gt("qty", 0).order("user_id").order("code").range(from, to)
    ),
    admin.from("shops").select("user_id").eq("enabled", true),
  ]);
  if (error) throw error;
  const itens = new Map<string, number>();
  for (const r of rows ?? []) itens.set(r.user_id, (itens.get(r.user_id) ?? 0) + 1);
  const comLoja = new Set((shops ?? []).map((s) => s.user_id as string));

  const candidatos = users.filter((u) => u.email && u.email_confirmed_at && (itens.get(u.id) ?? 0) > minItems && !comLoja.has(u.id));
  const out = {
    candidatos: candidatos.length,
    jaRecebidos: 0,
    semLojas: 0,
    enviados: 0,
    erros: 0,
    dryRun: Boolean(dryRun),
    pronto: emailConfigured(),
    destinatarios: [] as { email: string; assunto: string }[],
  };

  for (const user of candidatos) {
    if (user.app_metadata?.[SENT_KEY]) {
      out.jaRecebidos++;
      continue;
    }
    const input = await shopMatchInputFor(user);
    if (!input.collections.length) {
      out.semLojas++;
      continue;
    }
    const subject = shopMatchSubject(input);
    out.destinatarios.push({ email: user.email!, assunto: subject });
    if (dryRun || !out.pronto) continue;

    try {
      const id = await sendEmail({ to: user.email!, subject, html: shopMatchHtml(input), text: shopMatchText(input) });
      await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, [SENT_KEY]: new Date().toISOString(), email_lojas_com_o_que_falta_id: id },
      });
      out.enviados++;
    } catch (e) {
      console.error("lojas com o que falta (lote):", user.id, e);
      out.erros++;
    }
    await pause(600); // limite do Resend: 2 envios por segundo
  }
  return out;
}
