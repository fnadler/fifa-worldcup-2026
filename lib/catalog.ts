import paniniJson from "@/album.json";
import adrenalynJson from "./catalogs/adrenalyn-xl.json";
import goldenJson from "./catalogs/golden-crumple.json";
import type { AlbumBlock, AlbumData, TipoFiltro } from "./types";

// Cada coleção (álbum) da plataforma: blocos, filtros, grupos de preço e textos. O código de cada
// item é único na plataforma inteira (BRA1, LIL3, AXL24…), então funções por código (nome, bloco,
// descrição) consultam o índice global abaixo sem precisar saber a coleção.

export interface MenuSection {
  title: string;
  variant: string;
  blocks: AlbumBlock[];
}

export interface Catalog {
  /** Igual a albums.id no banco. */
  id: string;
  /** Endereço da coleção (/colecao/<slug>) — igual a albums.slug. */
  slug: string;
  name: string;
  /** Nome curto para textos ("Álbum Copa 2026"): pedido no WhatsApp, lista de repetidas. */
  shortName: string;
  itemSingular: string;
  itemPlural: string;
  /** Palavras de posse: Álbum Copa "colada/Coladas/coladas"; cards "tenho/Tenho/cards". */
  owned: { cell: string; total: string; block: string };
  /** Exemplo na busca. */
  searchPlaceholder: string;
  /** Código como as pessoas conhecem ("BRA9"; na Adrenalyn só o número: "24"). */
  displayCode(code: string): string;
  blocks: AlbumBlock[];
  /** Total que conta para Coladas/Faltam. */
  total: number;
  /** Filtro por tipo — o primeiro é sempre "ALL". */
  filters: { value: TipoFiltro; label: string }[];
  /**
   * Grupos de preço da loja, na ordem do formulário. A chave é o tipo do bloco ("TEAM") ou, para dividir
   * um tipo pelos cards dele, "tipo:tipo do card" ("TEAM:ICON") — ver priceFor em lib/shop.ts.
   */
  priceGroups: { key: string; label: string }[];
  countsToward(block: AlbumBlock): boolean;
  /** Etiqueta do bloco no quadro ("Grupo C", "FWC"…). */
  blockTag(block: AlbumBlock): string;
  /** Etiqueta destacada (blocos que não são seleções). */
  isSpecial(block: AlbumBlock): boolean;
  /** Faixa de códigos mostrada no cabeçalho do bloco ("BRA1–20"). */
  blockRange(block: AlbumBlock): string;
  /** Seções do menu "Grupos", na ordem do álbum. */
  menuSections: MenuSection[];
  /** Nome curto do bloco no menu "Grupos". */
  menuLabel(block: AlbumBlock): string;
  /** Código ao lado do nome no menu "Grupos" (sigla da seleção), ou null. */
  menuCode(block: AlbumBlock): string | null;
}

function numberOf(code: string): string {
  return code.replace(/^[A-Za-z]+/, "");
}

function sectionsBy(blocks: AlbumBlock[], key: (b: AlbumBlock) => { title: string; variant: string }): MenuSection[] {
  const out: MenuSection[] = [];
  blocks.forEach((b) => {
    const { title, variant } = key(b);
    const last = out[out.length - 1];
    if (last?.title === title) last.blocks.push(b);
    else out.push({ title, variant, blocks: [b] });
  });
  return out;
}

// ---------- Álbum Copa do Mundo 2026 (Panini) ----------

const panini = paniniJson as AlbumData;

function paniniTag(b: AlbumBlock): string {
  if (b.tipo === "TEAM") return `Grupo ${b.grupo}`;
  if (b.tipo === "FWC") return "FWC";
  if (b.tipo === "LEG") return "Legends";
  return "Extra";
}

const PANINI_VARIANT: Record<string, string> = { TEAM: "team", FWC: "fwc", CC: "cc", LEG: "leg" };

export const PANINI: Catalog = {
  id: "wc2026-panini",
  slug: "copa-2026",
  name: "Álbum Copa do Mundo 2026",
  shortName: "Álbum Copa 2026",
  itemSingular: "figurinha",
  itemPlural: "figurinhas",
  owned: { cell: "colada", total: "Coladas", block: "coladas" },
  searchPlaceholder: "Buscar seleção ou código (ex: BRA9)",
  displayCode: (code) => code,
  blocks: panini.blocks,
  // 994: as Legends são uma coleção à parte — aparecem no quadro e têm seus próprios contadores
  // por bloco, mas não entram em Coladas/Faltam.
  total: panini.total,
  filters: [
    { value: "ALL", label: "Todas" },
    { value: "TEAM", label: "Seleções" },
    { value: "FWC", label: "FWC" },
    { value: "CC", label: "Coca-Cola" },
    { value: "LEG", label: "Legends" },
  ],
  priceGroups: [
    { key: "FWC", label: "FWC" },
    { key: "TEAM", label: "Seleções" },
    { key: "CC", label: "Coca-Cola" },
    { key: "LEG", label: "Legends" },
  ],
  countsToward: (b) => b.tipo !== "LEG",
  blockTag: paniniTag,
  isSpecial: (b) => b.tipo !== "TEAM",
  // Mesmo texto do protótipo ("00 · FWC1–19", "BRA1–20", "CC1–14"), derivado dos próprios códigos.
  blockRange(b) {
    if (b.labels) return `${b.codes.length} atletas`;
    if (b.tipo === "FWC") return "00 · FWC1–19";
    const first = b.codes[0];
    const prefix = first.match(/^[A-Za-z]+/)?.[0] ?? "";
    return `${prefix}${numberOf(first)}–${numberOf(b.codes[b.codes.length - 1])}`;
  },
  // FWC, Grupo A…L (4 seleções cada), Coca-Cola e Legends — na ordem do álbum.
  menuSections: sectionsBy(panini.blocks, (b) => ({
    title: b.tipo === "TEAM" ? `Grupo ${b.grupo}` : b.tipo === "FWC" ? "FWC" : b.tipo === "CC" ? "Coca-Cola" : "Legends",
    variant: PANINI_VARIANT[b.tipo] ?? "team",
  })),
  menuLabel(b) {
    if (b.tipo === "FWC") return "World Cup History";
    if (b.tipo === "LEG") return b.nome.replace(/^Legends\s+/, "");
    return b.nome;
  },
  menuCode: (b) => (b.tipo === "TEAM" ? b.id : null),
};

// ---------- Adrenalyn XL (Panini, cards) ----------

const adrenalyn = adrenalynJson as AlbumData;

export const ADRENALYN: Catalog = {
  id: "wc2026-adrenalyn",
  slug: "adrenalyn-xl",
  name: "Adrenalyn XL",
  shortName: "Adrenalyn XL",
  itemSingular: "card",
  itemPlural: "cards",
  owned: { cell: "tenho", total: "Tenho", block: "cards" },
  searchPlaceholder: "Buscar jogador ou seleção (ex: messi)",
  // "AXL24" → "24"; Limited Editions (sem número oficial) → "LE12", "XL3"…
  displayCode: (code) => code.replace(/^AXL/, ""),
  blocks: adrenalyn.blocks,
  total: adrenalyn.total,
  filters: [
    { value: "ALL", label: "Todos" },
    { value: "TEAM", label: "Seleções" },
    { value: "SPECIAL", label: "Especiais" },
    { value: "CONTENDER", label: "Contenders" },
    { value: "LIMITED", label: "Limited" },
  ],
  // Nas seleções o preço é por tipo de card (cada seleção tem 1 Fan Favourite, 1 escudo, 1 Icon e 9 Heroes).
  priceGroups: [
    { key: "TEAM:FAN_FAVOURITE", label: "Fan Favourites" },
    { key: "TEAM:CREST", label: "Escudos" },
    { key: "TEAM:ICON", label: "Icons" },
    { key: "TEAM:BASE", label: "Heroes" },
    { key: "SPECIAL", label: "Especiais" },
    { key: "CONTENDER", label: "Contenders" },
    { key: "LIMITED", label: "Limited Editions" },
  ],
  // As Limited Editions ficam fora do total de 630 (como as Legends no Álbum Copa).
  countsToward: (b) => b.tipo !== "LIMITED",
  blockTag: (b) =>
    b.tipo === "TEAM" ? b.grupo : b.tipo === "CONTENDER" ? "Contenders" : b.tipo === "LIMITED" ? "Limited" : "Especial",
  isSpecial: (b) => b.tipo !== "TEAM",
  blockRange: (b) =>
    b.labels ? `${b.codes.length} cards` : `${numberOf(b.codes[0])}–${numberOf(b.codes[b.codes.length - 1])}`,
  // Seleções, Contenders e Especiais (Golden Ballers vem antes das seleções no checklist, mas fica junto
  // dos outros especiais no menu).
  menuSections: [
    { title: "Seleções", variant: "team", blocks: adrenalyn.blocks.filter((b) => b.tipo === "TEAM") },
    { title: "Contenders", variant: "cc", blocks: adrenalyn.blocks.filter((b) => b.tipo === "CONTENDER") },
    { title: "Especiais", variant: "fwc", blocks: adrenalyn.blocks.filter((b) => b.tipo === "SPECIAL") },
    { title: "Limited Editions", variant: "leg", blocks: adrenalyn.blocks.filter((b) => b.tipo === "LIMITED") },
  ],
  menuLabel: (b) => b.nome,
  menuCode: (b) => (b.tipo === "TEAM" ? b.grupo : null),
};

// ---------- Gold Crumple Edition ----------
// As figurinhas do Álbum Copa (FWC + seleções) com layout dourado. Códigos com prefixo GC (GCBRA9),
// mostrados sem ele.

const golden = goldenJson as AlbumData;
const goldenCode = (code: string) => code.replace(/^GC/, "");

export const GOLDEN_CRUMPLE: Catalog = {
  id: "wc2026-golden-crumple",
  slug: "golden-crumple-2026",
  name: "Gold Crumple Edition",
  shortName: "Gold Crumple",
  itemSingular: "figurinha",
  itemPlural: "figurinhas",
  owned: { cell: "colada", total: "Coladas", block: "coladas" },
  searchPlaceholder: "Buscar seleção ou código (ex: BRA9)",
  displayCode: goldenCode,
  blocks: golden.blocks,
  total: golden.total,
  filters: [
    { value: "ALL", label: "Todas" },
    { value: "TEAM", label: "Seleções" },
    { value: "FWC", label: "FWC" },
  ],
  priceGroups: [
    { key: "FWC", label: "FWC" },
    { key: "TEAM", label: "Seleções" },
  ],
  countsToward: () => true,
  blockTag: paniniTag,
  isSpecial: (b) => b.tipo !== "TEAM",
  blockRange(b) {
    if (b.tipo === "FWC") return "00 · FWC1–19";
    const first = goldenCode(b.codes[0]);
    const prefix = first.match(/^[A-Za-z]+/)?.[0] ?? "";
    return `${prefix}${numberOf(first)}–${numberOf(b.codes[b.codes.length - 1])}`;
  },
  menuSections: sectionsBy(golden.blocks, (b) => ({
    title: b.tipo === "TEAM" ? `Grupo ${b.grupo}` : "FWC",
    variant: PANINI_VARIANT[b.tipo] ?? "team",
  })),
  menuLabel: (b) => (b.tipo === "FWC" ? "World Cup History" : b.nome),
  menuCode: (b) => (b.tipo === "TEAM" ? b.id.replace(/^gc-/, "") : null),
};

// ---------- registro e índice global por código ----------

export const CATALOGS: Catalog[] = [PANINI, ADRENALYN, GOLDEN_CRUMPLE];
export const DEFAULT_CATALOG = PANINI;

const BY_ID = new Map(CATALOGS.map((c) => [c.id, c]));
const BY_SLUG = new Map(CATALOGS.map((c) => [c.slug, c]));

export function getCatalog(id: string | null | undefined): Catalog {
  return (id && BY_ID.get(id)) || DEFAULT_CATALOG;
}

export function catalogBySlug(slug: string): Catalog | undefined {
  return BY_SLUG.get(slug);
}

export interface CodeEntry {
  catalog: Catalog;
  block: AlbumBlock;
  index: number;
}

const BY_CODE = new Map<string, CodeEntry>();
const CATALOG_BY_BLOCK = new Map<AlbumBlock, Catalog>();
CATALOGS.forEach((catalog) =>
  catalog.blocks.forEach((block) => {
    CATALOG_BY_BLOCK.set(block, catalog);
    block.codes.forEach((code, index) => BY_CODE.set(code, { catalog, block, index }));
  })
);

export function lookupCode(code: string): CodeEntry | undefined {
  return BY_CODE.get(code);
}

export function catalogOfBlock(block: AlbumBlock): Catalog {
  return CATALOG_BY_BLOCK.get(block) ?? DEFAULT_CATALOG;
}

/** Coleção de um pedido/carrinho pelo primeiro item (os códigos são únicos na plataforma). */
export function catalogOfCodes(codes: string[]): Catalog {
  return (codes.length && BY_CODE.get(codes[0])?.catalog) || DEFAULT_CATALOG;
}
