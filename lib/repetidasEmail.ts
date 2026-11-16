import "server-only";
import type { User } from "@supabase/supabase-js";
import { getCatalog } from "./catalog";
import { repetidasHtml, repetidasSubject, repetidasText, type RepetidasEmailInput } from "./email/repetidas";
import { emailConfigured, sendEmail } from "./email/resend";
import { findUserByEmail, firstNameOf, listAllUsers, markSent, pause } from "./emailRecipients";
import { fetchAll } from "./fetchAll";
import { precosReferencia } from "./precosReferencia";
import { LIMITE_REPETIDAS, valorAproximado, valorRepetidas, type PrecosReferencia } from "./repetidasLoja";
import { TRIAL_DAYS } from "./stripe";
import { createAdminClient } from "./supabase/admin";

// E-mail "suas repetidas podem valer até R$ X": para quem passou de LIMITE_REPETIDAS repetidas e não tem loja. Envio
// único por conta (data em app_metadata). Fica de fora quem tem acesso à loja (assinatura ou cortesia).

const SENT_KEY = "email_repetidas_em";

interface Estoque {
  qtd: Record<string, number>;
  repetidas: number;
  porAlbum: Record<string, number>;
}

/** Quantidades de cada conta, e as repetidas por coleção. */
async function estoques(): Promise<Map<string, Estoque>> {
  const admin = createAdminClient();
  const [linhas, figurinhas] = await Promise.all([
    fetchAll<{ user_id: string; code: string; qty: number }>((from, to) =>
      admin.from("collection").select("user_id, code, qty").gt("qty", 1).order("user_id").order("code").range(from, to)
    ),
    fetchAll<{ code: string; album_id: string }>((from, to) => admin.from("stickers").select("code, album_id").order("code").range(from, to)),
  ]);
  if (linhas.error || figurinhas.error) throw linhas.error ?? figurinhas.error;
  const rows = linhas.data ?? [];
  const album = new Map((figurinhas.data ?? []).map((s) => [s.code, s.album_id]));
  const out = new Map<string, Estoque>();
  for (const r of rows) {
    const e = out.get(r.user_id) ?? { qtd: {}, repetidas: 0, porAlbum: {} };
    e.qtd[r.code] = r.qty;
    e.repetidas += r.qty - 1;
    const a = album.get(r.code);
    if (a) e.porAlbum[a] = (e.porAlbum[a] ?? 0) + r.qty - 1;
    out.set(r.user_id, e);
  }
  return out;
}

function inputFor(user: User, e: Estoque, precos: PrecosReferencia, jaAssinou: boolean): RepetidasEmailInput {
  const [maior] = Object.entries(e.porAlbum).sort((a, b) => b[1] - a[1]);
  const c = getCatalog(maior[0]);
  const cents = valorRepetidas(e.qtd, precos);
  return {
    firstName: firstNameOf(user),
    repetidas: e.repetidas,
    valor: cents > 0 ? valorAproximado(cents) : null,
    colecao: { name: c.shortName, slug: c.slug },
    trialDays: jaAssinou ? 0 : TRIAL_DAYS,
  };
}

async function contexto() {
  const admin = createAdminClient();
  const [lista, precos, { data: ents }, { data: subs }] = await Promise.all([
    estoques(),
    precosReferencia(),
    admin.from("shop_entitlements").select("user_id, expires_at"),
    admin.from("subscriptions").select("user_id, stripe_subscription_id"),
  ]);
  const agora = Date.now();
  const comLoja = new Set((ents ?? []).filter((e) => !e.expires_at || Date.parse(e.expires_at) > agora).map((e) => e.user_id as string));
  const jaAssinou = new Set((subs ?? []).filter((s) => s.stripe_subscription_id).map((s) => s.user_id as string));
  return { lista, precos, comLoja, jaAssinou };
}

export async function previewRepetidas(email: string) {
  const user = await findUserByEmail(email);
  if (!user?.email) return { status: "nao-encontrado" as const };
  const { lista, precos, jaAssinou } = await contexto();
  const e = lista.get(user.id);
  if (!e?.repetidas) return { status: "sem-repetidas" as const };
  const input = inputFor(user, e, precos, jaAssinou.has(user.id));
  return { status: "ok" as const, to: user.email, subject: repetidasSubject(input), html: repetidasHtml(input), text: repetidasText(input) };
}

/**
 * Teste para uma conta (não conta como envio do lote; vale mesmo abaixo do limite ou com loja). Com `destino`,
 * manda o e-mail montado com os números da conta `email` para outro endereço (validação com dados reais).
 */
export async function sendRepetidasTo(email: string, destino?: string | null): Promise<{ status: string; id?: string }> {
  if (!emailConfigured()) return { status: "desligado" };
  const p = await previewRepetidas(email);
  if (p.status !== "ok") return p;
  const to = destino?.trim() || p.to;
  return { status: "enviado", id: await sendEmail({ to, subject: destino ? `[Teste] ${p.subject}` : p.subject, html: p.html, text: p.text }) };
}

export interface RepetidasSweepOptions {
  dryRun?: boolean;
  exclude?: string[];
  limit?: number;
}

export async function sweepRepetidas({ dryRun, exclude = [], limit = 100 }: RepetidasSweepOptions) {
  const [users, { lista, precos, comLoja, jaAssinou }] = await Promise.all([listAllUsers(), contexto()]);
  const fora = exclude.map((x) => x.trim().toLowerCase()).filter(Boolean);
  const out = {
    acimaDoLimite: 0,
    comLoja: 0,
    excluidos: 0,
    jaRecebidos: 0,
    enviados: 0,
    erros: 0,
    dryRun: Boolean(dryRun),
    pronto: emailConfigured(),
    destinatarios: [] as { email: string; repetidas: number; valor: string | null; teste: boolean }[],
  };

  for (const user of users) {
    const e = lista.get(user.id);
    if (!user.email || !e || e.repetidas < LIMITE_REPETIDAS) continue;
    out.acimaDoLimite++;
    if (comLoja.has(user.id)) { out.comLoja++; continue; }
    if (fora.some((x) => user.email!.toLowerCase().includes(x))) { out.excluidos++; continue; }
    if (user.app_metadata?.[SENT_KEY]) { out.jaRecebidos++; continue; }

    const input = inputFor(user, e, precos, jaAssinou.has(user.id));
    out.destinatarios.push({ email: user.email, repetidas: e.repetidas, valor: input.valor, teste: input.trialDays > 0 });
    if (dryRun || !out.pronto || out.enviados + out.erros >= limit) continue;

    try {
      const id = await sendEmail({ to: user.email, subject: repetidasSubject(input), html: repetidasHtml(input), text: repetidasText(input) });
      await markSent(user, SENT_KEY, id);
      out.enviados++;
    } catch (err) {
      console.error("repetidas (lote):", user.id, err);
      out.erros++;
    }
    await pause(600); // limite do Resend: 2 envios por segundo
  }
  return out;
}
