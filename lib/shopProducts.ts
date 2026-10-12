import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_COLUMNS, productFromRow, type ShopProduct, type ShopProductRow } from "./shop";

/** Produtos de uma loja, na ordem do cadastro. `onlyActive`: só os que aparecem na vitrine. */
export async function loadShopProducts(client: SupabaseClient, userId: string, onlyActive = false): Promise<ShopProduct[]> {
  let q = client.from("shop_products").select(PRODUCT_COLUMNS).eq("user_id", userId);
  if (onlyActive) q = q.eq("active", true);
  const { data } = await q.order("position").order("created_at");
  return ((data as ShopProductRow[] | null) ?? []).map(productFromRow);
}
