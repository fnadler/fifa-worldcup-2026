import type { SupabaseClient } from "@supabase/supabase-js";
import { CATALOGS, DEFAULT_CATALOG, lookupCode } from "./catalog";
import { SHOP_ALBUM_COLUMNS, shopAlbumsFromRows, type ShopAlbum, type ShopAlbumRow } from "./shop";

// Leitura da configuração da loja por coleção (shop_albums) no servidor.

export async function loadShopAlbums(client: SupabaseClient, userId: string): Promise<ShopAlbum[]> {
  const { data } = await client.from("shop_albums").select(SHOP_ALBUM_COLUMNS).eq("user_id", userId);
  return shopAlbumsFromRows((data as ShopAlbumRow[] | null) ?? []);
}

/** albumId recebido do cliente: precisa ser uma coleção conhecida (padrão: Álbum Copa). */
export function parseAlbumId(v: unknown): string | null {
  if (v === undefined || v === null) return DEFAULT_CATALOG.id;
  return typeof v === "string" && CATALOGS.some((c) => c.id === v) ? v : null;
}

/** O código pertence à coleção? (um carrinho/pedido é sempre de uma coleção só) */
export function codeInAlbum(code: string, albumId: string): boolean {
  return lookupCode(code)?.catalog.id === albumId;
}
