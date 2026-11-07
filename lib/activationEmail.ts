import "server-only";
import type { User } from "@supabase/supabase-js";
import { albumCover } from "./albumCovers";
import { getCatalog } from "./catalog";
import { activationHtml, activationSubject, activationText, type ActivationEmailInput } from "./email/activation";
import { emailConfigured, sendEmail } from "./email/resend";
import { findUserByEmail, firstNameOf, listAllUsers, markSent, pause } from "./emailRecipients";
import { fetchAll } from "./fetchAll";
import { listShops } from "./shopDirectory";
import { createAdminClient } from "./supabase/admin";
import { userCollections } from "./userCollections";

// E-mail de ativação: para quem confirmou o e-mail e não marcou nenhum item. Envio único por conta (data em
// app_metadata). Fica de fora quem tem assinatura ou loja (loja vazia pede contato pessoal, não e-mail em
// massa) e quem se cadastrou há menos de 24 h (ainda pode estar começando).

const SITE = "https://www.gncoleciona.com.br";
const SENT_KEY = "email_ativacao_em";
const ASSINATURA_VIVA = new Set(["trialing", "active", "past_due", "unpaid", "incomplete"]);

async function inputFor(user: User, shopCount: number): Promise<ActivationEmailInput> {
  const [primeira] = await userCollections(createAdminClient(), user.id);
  const c = primeira ? getCatalog(primeira.albumId) : null;
  const capa = c ? albumCover(c.slug) : null;
  return {
    firstName: firstNameOf(user),
    shopCount,
    collection: c
      ? { name: c.shortName, slug: c.slug, total: c.total, itemPlural: c.itemPlural, coverUrl: capa ? `${SITE}${capa}` : null }
      : null,
  };
}

const lojasAbertas = async () => (await listShops()).length;

export async function previewActivationEmail(email: string) {
  const user = await findUserByEmail(email);
  if (!user?.email) return { status: "nao-encontrado" as const };
  const input = await inputFor(user, await lojasAbertas());
  return { status: "ok" as const, to: user.email, subject: activationSubject(input), html: activationHtml(input), text: activationText(input) };
}

/** Teste para uma conta (não conta como envio do lote). */
export async function sendActivationEmailTo(email: string): Promise<{ status: string; id?: string }> {
  if (!emailConfigured()) return { status: "desligado" };
  const p = await previewActivationEmail(email);
  if (p.status !== "ok") return p;
  return { status: "enviado", id: await sendEmail({ to: p.to, subject: p.subject, html: p.html, text: p.text }) };
}

export interface ActivationSweepOptions {
  dryRun?: boolean;
  /** Pedaços de e-mail a ignorar (contas de teste), ex.: ["fnadler", "+rastreio"]. */
  exclude?: string[];
  /** Máximo de envios nesta chamada. */
  limit?: number;
}

export async function sweepActivationEmails({ dryRun, exclude = [], limit = 200 }: ActivationSweepOptions) {
  const admin = createAdminClient();
  const [users, { data: rows, error }, { data: subs }, { data: shops }, shopCount] = await Promise.all([
    listAllUsers(),
    fetchAll<{ user_id: string }>((from, to) =>
      admin.from("collection").select("user_id").gt("qty", 0).order("user_id").order("code").range(from, to)
    ),
    admin.from("subscriptions").select("user_id, status"),
    admin.from("shops").select("user_id"),
    lojasAbertas(),
  ]);
  if (error) throw error;
  const comItens = new Set((rows ?? []).map((r) => r.user_id));
  const comAssinatura = new Set((subs ?? []).filter((s) => ASSINATURA_VIVA.has(s.status as string)).map((s) => s.user_id as string));
  const comLoja = new Set((shops ?? []).map((s) => s.user_id as string));
  const ontem = Date.now() - 86_400_000;
  const fora = exclude.map((x) => x.trim().toLowerCase()).filter(Boolean);

  const out = {
    semItens: 0,
    naoConfirmados: 0,
    recentes: 0,
    assinantesOuLoja: 0,
    excluidos: 0,
    jaRecebidos: 0,
    comColecao: 0,
    semColecao: 0,
    enviados: 0,
    erros: 0,
    dryRun: Boolean(dryRun),
    pronto: emailConfigured(),
    destinatarios: [] as { email: string; assunto: string }[],
  };

  for (const user of users) {
    if (!user.email || comItens.has(user.id)) continue;
    out.semItens++;
    if (!user.email_confirmed_at) { out.naoConfirmados++; continue; }
    if (new Date(user.created_at).getTime() > ontem) { out.recentes++; continue; }
    if (comAssinatura.has(user.id) || comLoja.has(user.id)) { out.assinantesOuLoja++; continue; }
    if (fora.some((x) => user.email!.toLowerCase().includes(x))) { out.excluidos++; continue; }
    if (user.app_metadata?.[SENT_KEY]) { out.jaRecebidos++; continue; }

    const input = await inputFor(user, shopCount);
    if (input.collection) out.comColecao++;
    else out.semColecao++;
    const subject = activationSubject(input);
    out.destinatarios.push({ email: user.email, assunto: subject });
    if (dryRun || !out.pronto || out.enviados + out.erros >= limit) continue;

    try {
      const id = await sendEmail({ to: user.email, subject, html: activationHtml(input), text: activationText(input) });
      await markSent(user, SENT_KEY, id);
      out.enviados++;
    } catch (e) {
      console.error("ativação (lote):", user.id, e);
      out.erros++;
    }
    await pause(600); // limite do Resend: 2 envios por segundo
  }
  return out;
}
