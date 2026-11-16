import "server-only";
import type { User } from "@supabase/supabase-js";
import { conviteHtml, conviteSubject, conviteText, type ConviteInput } from "./email/convite";
import { emailConfigured, sendEmail } from "./email/resend";
import { findUserByEmail, firstNameOf, listAllUsers, markSent, pause } from "./emailRecipients";
import { criarTokenEntrada, DESTINO_COLECIONAR, DESTINO_VENDER } from "./linkEntrada";
import { TRIAL_DAYS } from "./stripe";

// Convite para quem começou o cadastro e não confirmou o e-mail (o cadastro antigo pedia a confirmação por
// link e um terço parava aí). Envio único por conta (data em app_metadata). Fica de fora quem se cadastrou há
// menos de 24 h e contas de teste. Os botões entram na conta direto (lib/linkEntrada.ts, app/auth/entrar).

const SITE = "https://www.gncoleciona.com.br";
const SENT_KEY = "email_convite_cadastro_em";
const UTM = "utm_source=email&utm_medium=email&utm_campaign=convite_cadastro";

const link = (user: User, destino: typeof DESTINO_COLECIONAR) => `${SITE}/auth/entrar?t=${criarTokenEntrada(user.id, destino)}&${UTM}`;

function inputFor(user: User): ConviteInput {
  return {
    firstName: firstNameOf(user),
    linkColecao: link(user, DESTINO_COLECIONAR),
    linkLoja: link(user, DESTINO_VENDER),
    trialDays: TRIAL_DAYS,
  };
}

/** Pré-visualização para uma conta (os links do HTML são de verdade: não encaminhe o e-mail de outra pessoa). */
export async function previewConvite(email: string) {
  const user = await findUserByEmail(email);
  if (!user?.email) return { status: "nao-encontrado" as const };
  const input = inputFor(user);
  return { status: "ok" as const, to: user.email, subject: conviteSubject(input), html: conviteHtml(input), text: conviteText(input) };
}

/** Teste para uma conta (não conta como envio do lote). */
export async function sendConviteTo(email: string): Promise<{ status: string; id?: string }> {
  if (!emailConfigured()) return { status: "desligado" };
  const p = await previewConvite(email);
  if (p.status !== "ok") return p;
  return { status: "enviado", id: await sendEmail({ to: p.to, subject: p.subject, html: p.html, text: p.text }) };
}

export interface ConviteSweepOptions {
  dryRun?: boolean;
  /** Pedaços de e-mail a ignorar (contas de teste), ex.: ["fnadler", "+rastreio"]. */
  exclude?: string[];
  limit?: number;
  /** Só contas criadas a partir desta data (AAAA-MM-DD), ex.: o início da campanha. */
  desde?: string | null;
}

export async function sweepConvites({ dryRun, exclude = [], limit = 200, desde = null }: ConviteSweepOptions) {
  const users = await listAllUsers();
  const ontem = Date.now() - 86_400_000;
  const inicio = desde ? Date.parse(`${desde}T00:00:00-03:00`) : 0;
  const fora = ["+rastreio", ...exclude].map((x) => x.trim().toLowerCase()).filter(Boolean);
  const out = {
    naoConfirmados: 0,
    recentes: 0,
    antes: 0,
    excluidos: 0,
    jaRecebidos: 0,
    enviados: 0,
    erros: 0,
    dryRun: Boolean(dryRun),
    pronto: emailConfigured(),
    destinatarios: [] as { email: string; criadoEm: string }[],
  };

  for (const user of users) {
    if (!user.email || user.email_confirmed_at) continue;
    out.naoConfirmados++;
    const criado = new Date(user.created_at).getTime();
    if (criado > ontem) { out.recentes++; continue; }
    if (criado < inicio) { out.antes++; continue; }
    if (fora.some((x) => user.email!.toLowerCase().includes(x))) { out.excluidos++; continue; }
    if (user.app_metadata?.[SENT_KEY]) { out.jaRecebidos++; continue; }

    out.destinatarios.push({ email: user.email, criadoEm: user.created_at.slice(0, 10) });
    if (dryRun || !out.pronto || out.enviados + out.erros >= limit) continue;

    try {
      const input = inputFor(user);
      const id = await sendEmail({ to: user.email, subject: conviteSubject(input), html: conviteHtml(input), text: conviteText(input) });
      await markSent(user, SENT_KEY, id);
      out.enviados++;
    } catch (e) {
      console.error("convite (lote):", user.id, e);
      out.erros++;
    }
    await pause(600); // limite do Resend: 2 envios por segundo
  }
  return out;
}
