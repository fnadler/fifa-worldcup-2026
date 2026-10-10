import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { COMMUNITY_URL } from "./community";
import { communityInviteHtml, communityInviteSubject, communityInviteText } from "./email/communityInvite";
import { emailConfigured, sendEmail } from "./email/resend";
import { createAdminClient } from "./supabase/admin";

// Convite por e-mail para o grupo de WhatsApp: um por conta, registrado em community_invites.
// A linha é gravada ANTES do envio (a chave primária garante que duas chamadas simultâneas não mandem
// dois e-mails); se o envio falhar, a linha sai e a varredura tenta de novo depois.

type Resultado = "enviado" | "ja-enviado" | "sem-email" | "desligado" | "erro";

export function communityInviteReady(): boolean {
  return Boolean(COMMUNITY_URL) && emailConfigured();
}

function firstName(user: User): string | null {
  const nome = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return nome ? nome.split(/\s+/)[0] : null;
}

export async function sendCommunityInviteOnce(admin: SupabaseClient, user: User): Promise<Resultado> {
  if (!COMMUNITY_URL || !emailConfigured()) return "desligado";
  if (!user.email || !user.email_confirmed_at) return "sem-email";

  const { error: jaExiste } = await admin.from("community_invites").insert({ user_id: user.id });
  if (jaExiste) return "ja-enviado";

  try {
    const input = { firstName: firstName(user), groupUrl: COMMUNITY_URL };
    const id = await sendEmail({
      to: user.email,
      subject: communityInviteSubject,
      html: communityInviteHtml(input),
      text: communityInviteText(input),
    });
    await admin.from("community_invites").update({ email_id: id }).eq("user_id", user.id);
    return "enviado";
  } catch (e) {
    console.error("convite da comunidade:", user.id, e);
    await admin.from("community_invites").delete().eq("user_id", user.id);
    return "erro";
  }
}

/** Envia o convite a uma conta só, pelo e-mail (teste antes do envio geral). Conta como o envio dela. */
export async function sendCommunityInviteTo(email: string): Promise<Resultado | "nao-encontrado"> {
  const admin = createAdminClient();
  const alvo = email.trim().toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === alvo);
    if (user) return sendCommunityInviteOnce(admin, user);
    if (data.users.length < 1000) return "nao-encontrado";
  }
}

export interface SweepOptions {
  /** Só contas criadas nos últimos N dias (a varredura diária); sem isso, todas as contas. */
  sinceDays?: number;
  /** Máximo de e-mails nesta chamada. */
  limit: number;
  /** Só conta quem receberia, sem enviar. */
  dryRun?: boolean;
}

/** Envia o convite a quem tem e-mail confirmado e ainda não recebeu. */
export async function sweepCommunityInvites({ sinceDays, limit, dryRun }: SweepOptions) {
  const admin = createAdminClient();
  const desde = sinceDays ? Date.now() - sinceDays * 86_400_000 : 0;

  const pendentes: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    pendentes.push(...data.users.filter((u) => u.email && u.email_confirmed_at && new Date(u.created_at).getTime() >= desde));
    if (data.users.length < 1000) break;
  }

  const { data: enviados } = await admin.from("community_invites").select("user_id").range(0, 99_999);
  const ja = new Set((enviados ?? []).map((r) => r.user_id as string));
  const fila = pendentes.filter((u) => !ja.has(u.id));

  const out = { contas: pendentes.length, pendentes: fila.length, enviados: 0, erros: 0, pronto: communityInviteReady(), dryRun: Boolean(dryRun) };
  if (dryRun || !out.pronto) return out;

  for (const user of fila.slice(0, limit)) {
    const r = await sendCommunityInviteOnce(admin, user);
    if (r === "enviado") out.enviados++;
    else if (r === "erro") out.erros++;
    await new Promise((ok) => setTimeout(ok, 600)); // limite do Resend: 2 envios por segundo
  }
  return out;
}
