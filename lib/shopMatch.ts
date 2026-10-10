import "server-only";
import { getCatalog } from "./catalog";
import { fetchAll } from "./fetchAll";
import { loadActiveShops } from "./shopDirectory";
import { createAdminClient } from "./supabase/admin";

// Lojas que têm o que falta em UMA coleção da pessoa, no total e por categoria (os tipos de bloco do
// catálogo: Seleções, FWC, Coca-Cola, Legends…). Faltantes = itens sem nenhuma unidade; blocos fora do
// total (Legends, Limited) só entram se ela já tiver algum item deles. A loja "casa" com os faltantes
// que tem repetidos. Não desconta reservas de carrinhos.

export interface MatchCount {
  /** Faltantes da pessoa que a loja tem. */
  matched: number;
  /** Total de faltantes da pessoa. */
  missing: number;
}

export interface MatchCategory {
  key: string;
  label: string;
  missing: number;
}

export interface ShopMatch extends MatchCount {
  path: string;
  name: string;
  logoUrl: string | null;
  official: boolean;
  /** Por categoria (chave = tipo do bloco). */
  categories: Record<string, MatchCount>;
}

export interface ShopMatchResult {
  /** Endereço da coleção, para abrir a loja nela (?colecao=). */
  slug: string;
  missing: number;
  categories: MatchCategory[];
  shops: ShopMatch[];
}

export async function matchShops(userId: string, albumId: string): Promise<ShopMatchResult> {
  const catalog = getCatalog(albumId);
  const empty: ShopMatchResult = { slug: catalog.slug, missing: 0, categories: [], shops: [] };

  const admin = createAdminClient();
  const { data: rows } = await fetchAll<{ code: string }>((from, to) =>
    admin.from("collection").select("code").eq("user_id", userId).gt("qty", 0).order("code").range(from, to)
  );
  const owned = new Set((rows ?? []).map((r) => r.code));

  // faltantes da coleção → categoria de cada um
  const missing = new Map<string, string>();
  let tem = false;
  for (const b of catalog.blocks) {
    const temNoBloco = b.codes.some((code) => owned.has(code));
    tem ||= temNoBloco;
    if (!catalog.countsToward(b) && !temNoBloco) continue;
    for (const code of b.codes) if (!owned.has(code)) missing.set(code, b.tipo);
  }
  // sem nenhum item, tudo "falta" — não há o que recomendar
  if (!tem || !missing.size) return empty;

  const porCategoria = new Map<string, number>();
  for (const tipo of missing.values()) porCategoria.set(tipo, (porCategoria.get(tipo) ?? 0) + 1);
  // todas as categorias da coleção (com 0 quando a pessoa já tem tudo dela) — o filtro mostra todas
  const categories = catalog.filters
    .filter((f) => f.value !== "ALL")
    .map((f) => ({ key: f.value, label: f.label, missing: porCategoria.get(f.value) ?? 0 }));

  const shops: ShopMatch[] = [];
  for (const shop of await loadActiveShops()) {
    if (shop.userId === userId) continue;
    const matched = new Map<string, number>();
    for (const code of shop.codes.get(catalog.id) ?? []) {
      const tipo = missing.get(code);
      if (tipo) matched.set(tipo, (matched.get(tipo) ?? 0) + 1);
    }
    if (!matched.size) continue; // não tem nada do que falta nessa coleção
    shops.push({
      path: shop.path,
      name: shop.name,
      logoUrl: shop.logoUrl,
      official: shop.official,
      matched: [...matched.values()].reduce((n, v) => n + v, 0),
      missing: missing.size,
      categories: Object.fromEntries(categories.map((c) => [c.key, { matched: matched.get(c.key) ?? 0, missing: c.missing }])),
    });
  }
  shops.sort((a, b) => b.matched - a.matched || a.name.localeCompare(b.name));
  return { slug: catalog.slug, missing: missing.size, categories, shops };
}
