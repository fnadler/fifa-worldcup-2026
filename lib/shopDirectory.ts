import "server-only";
import { DEFAULT_SHOP_NAME } from "./brand";
import { CATALOGS, getCatalog, lookupCode } from "./catalog";
import { fetchAll } from "./fetchAll";
import { shopAlbumsFromRows, shopPath, type ShopAlbumRow } from "./shop";
import { createAdminClient } from "./supabase/admin";

// Lista pública de lojas (/lojas): lojas ligadas, com acesso à vitrine em dia e ao menos uma coleção
// à venda. Itens únicos = códigos com repetida (qty > 1) nas coleções à venda — sem somar o estoque.

export const OFFICIAL_SHOP_SLUG = "loja-oficial";

export interface DirectoryAlbum {
  albumId: string;
  slug: string;
  name: string;
  items: number;
}

export interface DirectoryShop {
  path: string;
  slug: string | null;
  name: string;
  logoUrl: string | null;
  official: boolean;
  albums: DirectoryAlbum[];
  items: number;
}

export async function listShops(): Promise<DirectoryShop[]> {
  const admin = createAdminClient();
  const { data: shops } = await admin
    .from("shops")
    .select("user_id, token, slug, logo_url, seller_name")
    .eq("enabled", true)
    .returns<{ user_id: string; token: string; slug: string | null; logo_url: string | null; seller_name: string | null }[]>();
  if (!shops?.length) return [];

  const ids = shops.map((s) => s.user_id);
  const [{ data: ents }, { data: albumRows }, { data: rows }] = await Promise.all([
    admin.from("shop_entitlements").select("user_id, expires_at").in("user_id", ids),
    admin.from("shop_albums").select("user_id, album_id, enabled, min_order_cents, group_prices").in("user_id", ids),
    fetchAll<{ user_id: string; code: string }>((from, to) =>
      admin.from("collection").select("user_id, code").in("user_id", ids).gt("qty", 1).order("user_id").order("code").range(from, to)
    ),
  ]);

  const now = new Date();
  const ativos = new Set(
    ((ents ?? []) as { user_id: string; expires_at: string | null }[])
      .filter((e) => !e.expires_at || new Date(e.expires_at) > now)
      .map((e) => e.user_id)
  );

  // itens únicos por loja e coleção
  const count = new Map<string, Map<string, number>>();
  for (const r of rows ?? []) {
    const albumId = lookupCode(r.code)?.catalog.id;
    if (!albumId) continue;
    const m = count.get(r.user_id) ?? new Map<string, number>();
    m.set(albumId, (m.get(albumId) ?? 0) + 1);
    count.set(r.user_id, m);
  }

  const out: DirectoryShop[] = [];
  for (const s of shops) {
    if (!ativos.has(s.user_id)) continue;
    const config = shopAlbumsFromRows(((albumRows ?? []) as (ShopAlbumRow & { user_id: string })[]).filter((r) => r.user_id === s.user_id));
    const albums = config
      .filter((a) => a.enabled)
      .map((a) => {
        const c = getCatalog(a.albumId);
        return { albumId: c.id, slug: c.slug, name: c.shortName, items: count.get(s.user_id)?.get(c.id) ?? 0 };
      });
    if (!albums.length) continue;
    out.push({
      path: shopPath(s),
      slug: s.slug,
      name: s.seller_name || DEFAULT_SHOP_NAME,
      logoUrl: s.logo_url,
      official: s.slug === OFFICIAL_SHOP_SLUG,
      albums,
      items: albums.reduce((n, a) => n + a.items, 0),
    });
  }
  // loja oficial primeiro; depois as com mais itens
  return out.sort((a, b) => Number(b.official) - Number(a.official) || b.items - a.items || a.name.localeCompare(b.name));
}

/** Coleções da plataforma, para o filtro (na ordem do catálogo). */
export function directoryCollections() {
  return CATALOGS.map((c) => ({ albumId: c.id, name: c.shortName }));
}
