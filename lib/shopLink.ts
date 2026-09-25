import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shopPath } from "./shop";
import { hasShopAccess } from "./shopAccess";

// Para onde "Minha loja" leva e se o usuário pode gerenciar a loja:
//   • sem acesso (não assina) → /assinar
//   • com acesso, loja ainda não criada → /vendas (a página cria)
//   • com acesso e loja criada → a loja pública (/slug ou /loja/token)
export async function ownShop(client: SupabaseClient, userId: string): Promise<{ href: string; active: boolean }> {
  if (!(await hasShopAccess(client, userId))) return { href: "/assinar", active: false };
  const { data } = await client
    .from("shops")
    .select("token, slug")
    .eq("user_id", userId)
    .maybeSingle<{ token: string; slug: string | null }>();
  return { href: data ? shopPath(data) : "/vendas", active: true };
}
