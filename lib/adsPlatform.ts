import "server-only";
import type { Attribution } from "./attribution";

// Envio dos cadastros ao sistema de inteligência de tráfego (ads-platform), que cruza a mídia da Meta com
// as assinaturas do Stripe. O lead vai com os UTMs e os IDs da Meta (último e primeiro toque); a venda o
// sistema lê direto do Stripe, pelo user_id gravado na assinatura. Mesma regra da CAPI: sem configuração
// só avisa no log, e erro ou demora nunca quebra quem chama (o histórico fica em marketing_attribution e
// pode ser reenviado com scripts/reenviar-leads-ads-platform.mjs).

const TIMEOUT_MS = 3000;

export interface LeadAdsPlatform {
  /** user.id do Supabase: o mesmo user_id que o checkout grava na assinatura do Stripe. */
  idExterno: string;
  ocorridoEm: string;
  email?: string | null;
  atribuicao: Attribution;
  primeiroToque?: Attribution;
}

const semTs = (a: Attribution): Attribution => {
  const copia = { ...a };
  delete copia.ts;
  return copia;
};

export async function enviarLeadAdsPlatform(lead: LeadAdsPlatform): Promise<void> {
  const base = process.env.ADS_PLATFORM_URL;
  const token = process.env.ADS_PLATFORM_TOKEN;
  if (!base || !token) return console.warn("[ads-platform] ADS_PLATFORM_URL/ADS_PLATFORM_TOKEN não configurados");
  try {
    const resposta = await fetch(`${base.replace(/\/$/, "")}/api/webhook/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        tipo: "lead",
        id_externo: lead.idExterno,
        ocorrido_em: lead.ocorridoEm,
        email: lead.email ?? undefined,
        atribuicao: semTs(lead.atribuicao),
        primeiro_toque: lead.primeiroToque ? semTs(lead.primeiroToque) : undefined,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) console.error("[ads-platform]", lead.idExterno, resposta.status, await resposta.text().catch(() => ""));
  } catch (err) {
    console.error("[ads-platform]", lead.idExterno, err);
  }
}
