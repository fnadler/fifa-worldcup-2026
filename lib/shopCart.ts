import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupCode } from "./catalog";
import { groupsOf, isProductCode, productsPricing, type ShopPricing, type ShopRow } from "./shop";
import { hasShopAccess } from "./shopAccess";
import { loadShopAlbums } from "./shopAlbums";
import { loadShopProducts } from "./shopProducts";

// Parte comum das rotas públicas da loja (carrinho e pedido): achar a loja, conferir se está
// recebendo pedidos e montar os preços — sempre no servidor, nunca confiando no cliente.

export type ShopForOrder = ShopRow & { user_id: string };

export type ShopLookup =
  | { ok: true; shop: ShopForOrder; pricing: ShopPricing }
  | { ok: false; error: string; status: number };

/** `codes`: itens pedidos — limita a leitura dos preços individuais a eles. */
export async function loadShopForOrder(admin: SupabaseClient, token: string, codes: string[]): Promise<ShopLookup> {
  const { data: shop } = await admin
    .from("shops")
    .select("user_id, token, enabled, seller_name, whatsapp, order_min_cents")
    .eq("token", token)
    .maybeSingle<ShopForOrder>();
  if (!shop) return { ok: false, error: "Loja não encontrada.", status: 404 };
  if (!shop.enabled || !(await hasShopAccess(admin, shop.user_id))) {
    return { ok: false, error: "Esta loja não está recebendo pedidos no momento.", status: 409 };
  }

  const stickerCodes = codes.filter((c) => !isProductCode(c));
  const [albums, products, { data: priceRows }] = await Promise.all([
    loadShopAlbums(admin, shop.user_id),
    codes.some(isProductCode) ? loadShopProducts(admin, shop.user_id, true) : Promise.resolve([]),
    stickerCodes.length
      ? admin.from("sticker_prices").select("code, price_cents").eq("user_id", shop.user_id).in("code", stickerCodes)
      : Promise.resolve({ data: [] as { code: string; price_cents: number }[] }),
  ]);
  const individual: Record<string, number> = {};
  (priceRows ?? []).forEach((r) => (individual[r.code as string] = r.price_cents as number));

  // groupsOf só traz as coleções à venda; o preço individual de uma coleção fora da loja não vale
  const groups = groupsOf(albums);
  for (const code of Object.keys(individual)) {
    if (!((lookupCode(code)?.catalog.id ?? "") in groups)) delete individual[code];
  }
  return { ok: true, shop, pricing: { groups, individual, products: productsPricing(products) } };
}

/** Código aceitável num carrinho: figurinha/card do catálogo ou produto ("PRD:<uuid>"). */
export function validItemCode(code: string): boolean {
  return isProductCode(code) ? /^PRD:[0-9a-f-]{36}$/i.test(code) : lookupCode(code) !== undefined;
}
