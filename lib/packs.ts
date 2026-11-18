import { DEFAULT_CATALOG } from "./catalog";

// Pacote Legends: lotes de pacotes numerados. Cada pacote tem 1 Legend (sorteada do pote do lote na
// abertura) e 7 figurinhas da Copa 2026 (sorteadas no pedido). Este arquivo vale no cliente e no servidor.

export type LotStatus = "rascunho" | "ativo" | "pausado" | "encerrado";

export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  rascunho: "Rascunho",
  ativo: "À venda",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

export const LOT_TITLE_MAX = 80;
export const LOT_DESCRIPTION_MAX = 1500;
export const LOT_SLUG_MAX = 40;
export const LOT_MAX_PACKS = 500;
export const LOT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const LOT_IMAGE_BUCKET = "pack-lots";
export const PACK_COMMONS = 7;

export interface PackLot {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  priceCents: number;
  /** null = usa o pedido mínimo da loja. */
  minOrderCents: number | null;
  startsAt: string | null;
  status: LotStatus;
  createdAt: string;
}

export interface PackLotRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  price_cents: number;
  min_order_cents: number | null;
  starts_at: string | null;
  status: LotStatus;
  created_at: string;
}

export const LOT_COLUMNS = "id, slug, title, description, image_url, price_cents, min_order_cents, starts_at, status, created_at";

export function lotFromRow(r: PackLotRow): PackLot {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    priceCents: r.price_cents,
    minOrderCents: r.min_order_cents,
    startsAt: r.starts_at,
    status: r.status,
    createdAt: r.created_at,
  };
}

/** Caminho público do lote: /<loja>/pacotes/<lote>. Sem endereço da loja, ainda não há página. */
export function lotPath(shopSlug: string | null, lotSlug: string): string | null {
  return shopSlug ? `/${shopSlug}/pacotes/${lotSlug}` : null;
}

// ---------- Legends ----------

export interface LegendTier {
  /** Prefixo dos códigos (LIL, BRO, PRA, OUR). */
  id: string;
  /** "Lilás", "Bronze"… */
  name: string;
  codes: string[];
  /** Nome do atleta por posição. */
  names: string[];
}

/** As 4 cores das Legends da Copa 2026, na ordem do álbum (Lilás, Bronze, Prata, Ouro). */
export const LEGEND_TIERS: LegendTier[] = DEFAULT_CATALOG.blocks
  .filter((b) => b.tipo === "LEG")
  .map((b) => ({ id: b.id, name: b.nome.replace(/^Legends\s+/, ""), codes: b.codes, names: b.labels ?? [] }));

export const LEGEND_CODES = new Set(LEGEND_TIERS.flatMap((t) => t.codes));

export function legendTierOf(code: string): LegendTier | undefined {
  return LEGEND_TIERS.find((t) => t.codes.includes(code));
}

/** "Lionel Messi" */
export function legendName(code: string): string {
  const t = legendTierOf(code);
  return t ? (t.names[t.codes.indexOf(code)] ?? code) : code;
}

/** Quantidade por código: { LIL13: 3, BRO2: 1 } */
export type LegendCount = Record<string, number>;
