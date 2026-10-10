import "server-only";
import { CATALOGS } from "./catalog";
import { fetchAll } from "./fetchAll";
import { loadActiveShops } from "./shopDirectory";
import { createAdminClient } from "./supabase/admin";

// Lojas que têm o que falta na coleção de uma pessoa. Para cada coleção que ela já começou:
// faltantes = itens que contam para o total (mais Legends/Limited, se ela já tiver alguma) sem nenhuma
// unidade; a loja "casa" com os faltantes que tem repetidos. Não desconta reservas de carrinhos.

export interface ShopMatchAlbum {
  albumId: string;
  slug: string;
  name: string;
  /** Faltantes da pessoa que a loja tem. */
  matched: number;
  /** Total de faltantes da pessoa nessa coleção. */
  missing: number;
}

export interface ShopMatch {
  path: string;
  name: string;
  logoUrl: string | null;
  official: boolean;
  matched: number;
  albums: ShopMatchAlbum[];
}

export async function matchShops(userId: string): Promise<ShopMatch[]> {
  const admin = createAdminClient();
  const { data: rows } = await fetchAll<{ code: string }>((from, to) =>
    admin.from("collection").select("code").eq("user_id", userId).gt("qty", 0).order("code").range(from, to)
  );
  const owned = new Set((rows ?? []).map((r) => r.code));
  if (!owned.size) return [];

  // faltantes por coleção — só coleções em que a pessoa já tem algum item
  const missing = new Map<string, Set<string>>();
  for (const c of CATALOGS) {
    const falta = new Set<string>();
    let tem = false;
    for (const b of c.blocks) {
      const temNoBloco = b.codes.some((code) => owned.has(code));
      tem ||= temNoBloco;
      // blocos fora do total (Legends, Limited) só entram se ela já coleciona esse bloco
      if (!c.countsToward(b) && !temNoBloco) continue;
      for (const code of b.codes) if (!owned.has(code)) falta.add(code);
    }
    if (tem && falta.size) missing.set(c.id, falta);
  }
  if (!missing.size) return [];

  const out: ShopMatch[] = [];
  for (const shop of await loadActiveShops()) {
    if (shop.userId === userId) continue;
    const albums: ShopMatchAlbum[] = [];
    for (const c of CATALOGS) {
      const falta = missing.get(c.id);
      const codes = shop.codes.get(c.id);
      if (!falta || !codes) continue;
      const matched = codes.reduce((n, code) => n + (falta.has(code) ? 1 : 0), 0);
      if (matched) albums.push({ albumId: c.id, slug: c.slug, name: c.shortName, matched, missing: falta.size });
    }
    if (!albums.length) continue;
    out.push({
      path: shop.path,
      name: shop.name,
      logoUrl: shop.logoUrl,
      official: shop.official,
      matched: albums.reduce((n, a) => n + a.matched, 0),
      albums,
    });
  }
  return out.sort((a, b) => b.matched - a.matched || a.name.localeCompare(b.name));
}
