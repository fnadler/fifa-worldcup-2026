import "server-only";
import { DEFAULT_SHOP_NAME } from "./brand";
import { CATALOGS, getCatalog, lookupCode } from "./catalog";
import { fetchAll } from "./fetchAll";
import { groupsOf, priceFor, shopAlbumsFromRows, shopPath, type ShopAlbumRow } from "./shop";
import { createAdminClient } from "./supabase/admin";

// Lista pública de lojas (/lojas): lojas ligadas, com acesso à vitrine em dia e ao menos uma coleção
// à venda com item disponível ou um produto ativo com estoque. Itens únicos = códigos com repetida (qty > 1) e preço
// nas coleções à venda, mais os produtos — sem somar o estoque.

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
  /** Produtos especiais à venda (ativos e com estoque). */
  products: number;
  items: number;
}

/** Loja ativa com os códigos à venda (repetidas) de cada coleção — base de /lojas e da busca por faltantes. */
export interface ActiveShop extends Omit<DirectoryShop, "albums" | "items"> {
  userId: string;
  /** Coleções à venda → códigos com repetida. */
  codes: Map<string, string[]>;
}

export async function loadActiveShops(): Promise<ActiveShop[]> {
  const admin = createAdminClient();
  const { data: shops } = await admin
    .from("shops")
    .select("user_id, token, slug, logo_url, seller_name")
    .eq("enabled", true)
    .returns<{ user_id: string; token: string; slug: string | null; logo_url: string | null; seller_name: string | null }[]>();
  if (!shops?.length) return [];

  const ids = shops.map((s) => s.user_id);
  const [{ data: ents }, { data: albumRows }, { data: rows }, { data: productRows }, { data: priceRows }] = await Promise.all([
    admin.from("shop_entitlements").select("user_id, expires_at").in("user_id", ids),
    admin.from("shop_albums").select("user_id, album_id, enabled, min_order_cents, group_prices").in("user_id", ids),
    fetchAll<{ user_id: string; code: string }>((from, to) =>
      admin.from("collection").select("user_id, code").in("user_id", ids).gt("qty", 1).order("user_id").order("code").range(from, to)
    ),
    admin.from("shop_products").select("user_id").in("user_id", ids).eq("active", true).gt("stock", 0),
    fetchAll<{ user_id: string; code: string; price_cents: number }>((from, to) =>
      admin.from("sticker_prices").select("user_id, code, price_cents").in("user_id", ids).order("user_id").order("code").range(from, to)
    ),
  ]);
  // preços individuais por loja (um item só está à venda se tiver preço — de grupo ou individual)
  const individuais = new Map<string, Record<string, number>>();
  for (const p of priceRows ?? []) {
    const m = individuais.get(p.user_id) ?? {};
    m[p.code] = p.price_cents;
    individuais.set(p.user_id, m);
  }
  const produtos = new Map<string, number>();
  for (const p of (productRows ?? []) as { user_id: string }[]) produtos.set(p.user_id, (produtos.get(p.user_id) ?? 0) + 1);

  const now = new Date();
  const ativos = new Set(
    ((ents ?? []) as { user_id: string; expires_at: string | null }[])
      .filter((e) => !e.expires_at || new Date(e.expires_at) > now)
      .map((e) => e.user_id)
  );

  // códigos com repetida por loja e coleção
  const byShop = new Map<string, Map<string, string[]>>();
  for (const r of rows ?? []) {
    const albumId = lookupCode(r.code)?.catalog.id;
    if (!albumId) continue;
    const m = byShop.get(r.user_id) ?? new Map<string, string[]>();
    const list = m.get(albumId) ?? [];
    list.push(r.code);
    m.set(albumId, list);
    byShop.set(r.user_id, m);
  }

  const out: ActiveShop[] = [];
  for (const s of shops) {
    if (!ativos.has(s.user_id)) continue;
    const config = shopAlbumsFromRows(((albumRows ?? []) as (ShopAlbumRow & { user_id: string })[]).filter((r) => r.user_id === s.user_id));
    const aVenda = config.filter((a) => a.enabled);
    const products = produtos.get(s.user_id) ?? 0;
    if (!aVenda.length && !products) continue;
    const pricing = { groups: groupsOf(aVenda), individual: individuais.get(s.user_id) ?? {} };
    const comPreco = (list: string[]) => list.filter((code) => priceFor(code, pricing) !== null);
    out.push({
      products,
      userId: s.user_id,
      path: shopPath(s),
      slug: s.slug,
      name: s.seller_name || DEFAULT_SHOP_NAME,
      logoUrl: s.logo_url,
      official: s.slug === OFFICIAL_SHOP_SLUG,
      codes: new Map(aVenda.map((a) => [a.albumId, comPreco(byShop.get(s.user_id)?.get(a.albumId) ?? [])])),
    });
  }
  return out;
}

export async function listShops(): Promise<DirectoryShop[]> {
  const out = (await loadActiveShops()).flatMap((shop): DirectoryShop[] => {
    // só as coleções com ao menos um item à venda; loja sem nenhum item (nem produto) fica de fora
    const albums = [...shop.codes]
      .filter(([, list]) => list.length > 0)
      .map(([albumId, list]) => {
        const c = getCatalog(albumId);
        return { albumId: c.id, slug: c.slug, name: c.shortName, items: list.length };
      });
    if (!albums.length && !shop.products) return [];
    const entry: DirectoryShop = {
      path: shop.path,
      slug: shop.slug,
      name: shop.name,
      logoUrl: shop.logoUrl,
      official: shop.official,
      albums,
      products: shop.products,
      items: albums.reduce((n, a) => n + a.items, 0) + shop.products,
    };
    return [entry];
  });
  // loja oficial primeiro; depois as com mais itens
  return out.sort((a, b) => Number(b.official) - Number(a.official) || b.items - a.items || a.name.localeCompare(b.name));
}

/** Coleções da plataforma, para o filtro (na ordem do catálogo). */
export function directoryCollections() {
  return CATALOGS.map((c) => ({ albumId: c.id, name: c.shortName }));
}
