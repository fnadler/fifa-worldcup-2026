import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { codigoHtml, codigoSubject, codigoText } from "./email/codigo";
import { emailConfigured, sendEmail } from "./email/resend";
import { TOO_MANY, withinRateLimit } from "./rateLimit";
import { createAdminClient } from "./supabase/admin";

// Confirmação do e-mail só na hora de ativar o teste grátis da loja (o cadastro não pede mais o link de
// confirmação: quem vem do Instagram perdia o caminho ao abrir o e-mail em outro app). Um código de 6 dígitos
// vai por e-mail e é digitado na própria tela de assinatura.
//
// Quem precisa: contas criadas no fluxo novo (user_metadata.verificacao = "pendente") que ainda não
// confirmaram. Contas antigas confirmaram pelo link no cadastro e não têm a marca. A confirmação fica em
// app_metadata (só o servidor escreve). Sem o envio de e-mail configurado, não bloqueia o teste.

const VALIDADE_MIN = 15;
const MAX_TENTATIVAS = 5;
const ESPERA_REENVIO_S = 45;

interface CodigoGuardado {
  hash: string;
  expira: number;
  tentativas: number;
  enviado: number;
}

const resumo = (userId: string, codigo: string) =>
  createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "gn").update(`${userId}:${codigo}`).digest("hex");

export function precisaVerificar(user: User): boolean {
  if (!emailConfigured()) return false;
  if (user.app_metadata?.email_verificado_em) return false;
  return user.user_metadata?.verificacao === "pendente";
}

async function atual(userId: string): Promise<User> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error || !data.user) throw error ?? new Error("conta não encontrada");
  return data.user;
}

async function gravar(user: User, extra: Record<string, unknown>) {
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, ...extra } });
  if (error) throw error;
}

export type Resposta = { ok: true; mensagem?: string } | { ok: false; erro: string };

export async function enviarCodigo(sessao: User, request: Request): Promise<Resposta> {
  if (!sessao.email) return { ok: false, erro: "Sua conta não tem e-mail." };
  if (!(await withinRateLimit(createAdminClient(), request, [{ name: "codigo-email", windowSeconds: 900, max: 6 }]))) {
    return { ok: false, erro: TOO_MANY };
  }
  const user = await atual(sessao.id);
  const anterior = user.app_metadata?.email_codigo as CodigoGuardado | null | undefined;
  const espera = anterior ? Math.ceil((anterior.enviado + ESPERA_REENVIO_S * 1000 - Date.now()) / 1000) : 0;
  if (espera > 0) return { ok: false, erro: `Espere ${espera} segundos para pedir outro código.` };

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const agora = Date.now();
  await gravar(user, { email_codigo: { hash: resumo(user.id, codigo), expira: agora + VALIDADE_MIN * 60_000, tentativas: 0, enviado: agora } });
  await sendEmail({ to: user.email!, subject: codigoSubject(codigo), html: codigoHtml(codigo, VALIDADE_MIN), text: codigoText(codigo, VALIDADE_MIN) });
  return { ok: true, mensagem: `Enviamos um código para ${user.email}. Confira também a caixa de spam.` };
}

export async function conferirCodigo(sessao: User, digitado: string): Promise<Resposta> {
  const codigo = digitado.replace(/\D/g, "");
  if (codigo.length !== 6) return { ok: false, erro: "O código tem 6 números." };
  const user = await atual(sessao.id);
  if (user.app_metadata?.email_verificado_em) return { ok: true };
  const guardado = user.app_metadata?.email_codigo as CodigoGuardado | null | undefined;
  if (!guardado) return { ok: false, erro: "Peça um código primeiro." };
  if (Date.now() > guardado.expira) return { ok: false, erro: "Esse código venceu. Peça um novo." };
  if (guardado.tentativas >= MAX_TENTATIVAS) return { ok: false, erro: "Muitas tentativas com esse código. Peça um novo." };

  const a = Buffer.from(resumo(user.id, codigo));
  const b = Buffer.from(guardado.hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await gravar(user, { email_codigo: { ...guardado, tentativas: guardado.tentativas + 1 } });
    const restam = MAX_TENTATIVAS - guardado.tentativas - 1;
    return { ok: false, erro: restam > 0 ? `Código errado. Restam ${restam} tentativa${restam === 1 ? "" : "s"}.` : "Código errado. Peça um novo." };
  }
  await marcarVerificado(user);
  return { ok: true };
}

/** E-mail confirmado (pelo código, ou pelo link do convite que só chega a quem abre o e-mail). */
export async function marcarVerificado(user: User): Promise<void> {
  await gravar(user, { email_verificado_em: new Date().toISOString(), email_codigo: null });
}
