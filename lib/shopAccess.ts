import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Funciona tanto com o client do usuário (RLS deixa ler só a própria linha)
// quanto com o admin client (para checar o dono de uma loja pública).
export async function hasShopAccess(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await client
    .from("shop_entitlements")
    .select("expires_at")
    .eq("user_id", userId)
    .maybeSingle<{ expires_at: string | null }>();
  return !!data && (!data.expires_at || new Date(data.expires_at) > new Date());
}
