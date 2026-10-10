import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Limite de uso por IP nas rotas públicas (carrinho e pedido da loja). A contagem fica no banco
// (rate_limit_hit, janelas fixas) — ver supabase_migration_rate_limits.sql.

export interface RateRule {
  /** Nome da contagem (ex: "pedido"). */
  name: string;
  windowSeconds: number;
  max: number;
}

/** IP de quem chamou. Na Vercel esses cabeçalhos são preenchidos pela plataforma (o cliente não os forja). */
export function clientIp(request: Request): string {
  const h = request.headers;
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
}

// O IP não é guardado: a chave é um resumo dele, que só serve para contar.
function ipKey(ip: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "gn").update(ip).digest("hex").slice(0, 32);
}

/**
 * Conta esta chamada em cada regra e diz se ela cabe em todas. Se a contagem falhar (ex: migração
 * ainda não aplicada), deixa passar e registra o erro — o limite não pode derrubar a loja.
 */
export async function withinRateLimit(admin: SupabaseClient, request: Request, rules: RateRule[]): Promise<boolean> {
  const ip = ipKey(clientIp(request));
  const results = await Promise.all(
    rules.map((r) =>
      admin.rpc("rate_limit_hit", { p_key: `${r.name}:${ip}`, p_window_seconds: r.windowSeconds, p_max: r.max })
    )
  );
  let ok = true;
  results.forEach(({ data, error }, i) => {
    if (error) console.error("[rate limit]", rules[i].name, error.message);
    else if (data === false) ok = false;
  });
  return ok;
}

export const TOO_MANY = "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.";
