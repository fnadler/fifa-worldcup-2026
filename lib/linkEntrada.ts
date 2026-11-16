import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Link de entrada do e-mail de convite (para quem começou o cadastro e não confirmou o e-mail): abre a conta
// sem senha e já confirma o e-mail, porque só chega a quem tem acesso à caixa de entrada. Assinado com a chave
// do servidor, com validade e destino fixo; uso único (ver app/auth/entrar).

const DESTINOS = ["/colecoes/comecar?para=colecionar", "/colecoes/comecar?para=vender"] as const;
export type DestinoEntrada = (typeof DESTINOS)[number];
export const DESTINO_COLECIONAR: DestinoEntrada = DESTINOS[0];
export const DESTINO_VENDER: DestinoEntrada = DESTINOS[1];

interface Carga {
  u: string; // user id
  d: number; // índice do destino
  e: number; // expira (epoch s)
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const assinar = (dados: string) => createHmac("sha256", `${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}:entrada`).update(dados).digest("base64url");

export function criarTokenEntrada(userId: string, destino: DestinoEntrada, dias = 14): string {
  const dados = b64(JSON.stringify({ u: userId, d: DESTINOS.indexOf(destino), e: Math.floor(Date.now() / 1000) + dias * 86_400 } satisfies Carga));
  return `${dados}.${assinar(dados)}`;
}

/** Devolve a conta e o destino, ou null se o token for inválido ou estiver vencido. */
export function lerTokenEntrada(token: string | null): { userId: string; destino: DestinoEntrada; assinatura: string } | null {
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const [dados, sig] = token.split(".");
  if (!dados || !sig) return null;
  const esperado = Buffer.from(assinar(dados));
  const recebido = Buffer.from(sig);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  try {
    const c = JSON.parse(Buffer.from(dados, "base64url").toString()) as Carga;
    if (typeof c.u !== "string" || !DESTINOS[c.d] || c.e < Date.now() / 1000) return null;
    return { userId: c.u, destino: DESTINOS[c.d], assinatura: sig };
  } catch {
    return null;
  }
}
