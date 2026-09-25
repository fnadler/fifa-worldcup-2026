import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shopPath } from "./shop";
import { hasShopAccess } from "./shopAccess";

// Para onde o ícone "loja" leva: a loja pública do usuário ou, se ele ainda não
// configurou a loja, a página de configuração (que a cria). null = sem acesso à loja.
export async function ownShopHref(client: SupabaseClient, userId: string): Promise<string | null> {
  if (!(await hasShopAccess(client, userId))) return null;
  const { data } = await client
    .from("shops")
    .select("token, slug")
    .eq("user_id", userId)
    .maybeSingle<{ token: string; slug: string | null }>();
  return data ? shopPath(data) : "/vendas";
}
