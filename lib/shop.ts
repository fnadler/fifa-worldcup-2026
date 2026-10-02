import { displayCode, stickerName } from "./album";
import { CATALOGS, DEFAULT_CATALOG, catalogOfCodes, lookupCode } from "./catalog";
import { normalizeWhatsapp } from "./phone";

export { isValidPhoneBR, maskPhoneBR, normalizeWhatsapp, onlyDigits } from "./phone";
import type { BlockType } from "./types";

export type OrderStatus = "novo" | "confirmado" | "cancelado";
export type CancelReason = "manual" | "expirado" | "assinatura" | null;

export const RESERVA_HORAS = 24; // pedido novo segura as figurinhas por 24h
export const CARRINHO_MINUTOS = 10; // carrinho segura as figurinhas por 10 min

export interface CartHold {
  items: { code: string; qty: number }[];
  expiresAt: string | null;
}

/** Preço por grupo (BlockType da coleção → centavos; null = grupo sem preço). */
export type GroupPrices = Record<BlockType, number | null>;

// Preços em centavos. Individual sobrepõe o do grupo; sem nenhum dos dois = não vendável.
// O preço de grupo é por coleção (o tipo "TEAM" existe em mais de uma).
export interface ShopPricing {
  /** albums.id → preço por grupo daquela coleção (só as coleções à venda). */
  groups: Record<string, GroupPrices>;
  individual: Record<string, number>;
}

/** Configuração da loja para uma coleção (tabela shop_albums). */
export interface ShopAlbum {
  albumId: string;
  /** Coleção à venda na loja. */
  enabled: boolean;
  minOrderCents: number;
  groupPrices: GroupPrices;
}

export interface ShopAlbumRow {
  album_id: string;
  enabled: boolean;
  min_order_cents: number;
  group_prices: GroupPrices | null;
}

export const SHOP_ALBUM_COLUMNS = "album_id, enabled, min_order_cents, group_prices";

/** Uma entrada por coleção da plataforma; sem linha no banco = fora da loja (Álbum Copa: à venda). */
export function shopAlbumsFromRows(rows: ShopAlbumRow[] | null): ShopAlbum[] {
  return CATALOGS.map((c) => {
    const r = rows?.find((x) => x.album_id === c.id);
    return {
      albumId: c.id,
      enabled: r ? r.enabled : c.id === DEFAULT_CATALOG.id,
      minOrderCents: r?.min_order_cents ?? 0,
      groupPrices: r?.group_prices ?? {},
    };
  });
}

/** Preços de grupo das coleções à venda, no formato de ShopPricing.groups. */
export function groupsOf(albums: ShopAlbum[]): Record<string, GroupPrices> {
  return Object.fromEntries(albums.filter((a) => a.enabled).map((a) => [a.albumId, a.groupPrices]));
}

export interface ShopSettings {
  token: string;
  /** Endereço público (/slug). null até o lojista definir o nome da loja. */
  slug: string | null;
  logoUrl: string | null;
  /** Loja mostra só o que está à venda (sem o filtro "Catálogo completo"). */
  onlyAvailable: boolean;
  enabled: boolean;
  sellerName: string;
  whatsapp: string;
}

export interface OrderItem {
  code: string;
  qty: number;
  unit_cents: number;
}

export interface BuyerInfo {
  name: string;
  email: string;
  whatsapp: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export interface Order {
  id: string;
  number: number;
  /** Coleção do pedido (um pedido é sempre de uma coleção só). */
  albumId: string;
  status: OrderStatus;
  buyer: BuyerInfo;
  items: OrderItem[];
  totalCents: number;
  createdAt: string;
  reservedUntil: string;
  cancelReason: CancelReason;
}

/** Caminho público da loja: /slug quando definido; senão o link permanente por token. */
export function shopPath(shop: { slug?: string | null; token: string }): string {
  return shop.slug ? `/${shop.slug}` : `/loja/${shop.token}`;
}

export interface ShopRow {
  token: string;
  slug?: string | null;
  logo_url?: string | null;
  only_available?: boolean;
  enabled: boolean;
  seller_name: string | null;
  whatsapp: string | null;
}

export interface OrderRow {
  id: string;
  number: number;
  album_id: string | null;
  status: OrderStatus;
  buyer_name: string;
  buyer_email: string;
  buyer_whatsapp: string;
  address_cep: string;
  address_street: string;
  address_number: string;
  address_complement: string | null;
  address_district: string;
  address_city: string;
  address_state: string;
  items: OrderItem[];
  total_cents: number;
  created_at: string;
  reserved_until: string;
  cancel_reason: CancelReason;
}

export const ORDER_COLUMNS =
  "id, number, album_id, status, buyer_name, buyer_email, buyer_whatsapp, address_cep, address_street, address_number, address_complement, address_district, address_city, address_state, items, total_cents, created_at, reserved_until, cancel_reason";

export function isKnownCode(code: string): boolean {
  return lookupCode(code) !== undefined;
}

export function blockNameFor(code: string): string {
  return lookupCode(code)?.block.nome ?? "";
}

// "Lionel Messi · Legends Ouro" para figurinhas com nome; senão só o bloco ("Brasil").
export function describeSticker(code: string): string {
  const nome = stickerName(code);
  return nome ? `${nome} · ${blockNameFor(code)}` : blockNameFor(code);
}

export function priceFor(code: string, pricing: ShopPricing): number | null {
  const individual = pricing.individual[code];
  if (individual !== undefined) return individual;
  const e = lookupCode(code);
  return e ? (pricing.groups[e.catalog.id]?.[e.block.tipo] ?? null) : null;
}

// Só as repetidas estão à venda — a figurinha colada no álbum nunca sai.
export function availableFromQty(qty: number): number {
  return Math.max(qty - 1, 0);
}

export function settingsFromRow(row: ShopRow): ShopSettings {
  return {
    token: row.token,
    slug: row.slug ?? null,
    logoUrl: row.logo_url ?? null,
    onlyAvailable: row.only_available ?? false,
    enabled: row.enabled,
    sellerName: row.seller_name ?? "",
    whatsapp: row.whatsapp ?? "",
  };
}

export function orderFromRow(row: OrderRow): Order {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    buyer: {
      name: row.buyer_name,
      email: row.buyer_email,
      whatsapp: row.buyer_whatsapp,
      cep: row.address_cep,
      street: row.address_street,
      number: row.address_number,
      complement: row.address_complement ?? "",
      district: row.address_district,
      city: row.address_city,
      state: row.address_state,
    },
    items: row.items,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    reservedUntil: row.reserved_until,
    cancelReason: row.cancel_reason,
    albumId: row.album_id ?? DEFAULT_CATALOG.id,
  };
}

// Pedido novo cujo prazo de reserva já passou (o banco o marca como cancelado/expirado
// na próxima leitura; aqui tratamos como expirado desde já).
export function isExpired(o: Order, now: number): boolean {
  return o.status === "novo" && Date.parse(o.reservedUntil) <= now;
}

// Quantidade reservada por código em pedidos novos dentro do prazo.
export function reservedByCode(orders: Order[], now: number, excludeId?: string): Record<string, number> {
  const out: Record<string, number> = {};
  orders.forEach((o) => {
    if (o.status !== "novo" || isExpired(o, now) || o.id === excludeId) return;
    o.items.forEach((it) => (out[it.code] = (out[it.code] ?? 0) + it.qty));
  });
  return out;
}

const HORA_BR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTimeBR(iso: string): string {
  return HORA_BR.format(new Date(iso));
}

// ---------- dinheiro ----------

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

// "2,50" / "R$ 2,50" / "2.5" -> 250. Vazio -> null. Inválido -> NaN.
export function parseBRL(input: string): number | null {
  const s = input.replace(/R\$|\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return NaN;
  return Math.round(parseFloat(normalized) * 100);
}

export function centsToInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

// ---------- WhatsApp ----------

export function whatsappLink(number: string, text?: string): string {
  const base = `https://wa.me/${normalizeWhatsapp(number)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function formatAddress(b: BuyerInfo): string {
  const linha1 = [`${b.street}, ${b.number}`, b.complement].filter(Boolean).join(" — ");
  return `${linha1} — ${b.district} — ${b.city}/${b.state} — CEP ${b.cep}`;
}

export function orderMessage(
  number: number,
  items: OrderItem[],
  totalCents: number,
  buyer: BuyerInfo,
  reservedUntil?: string
): string {
  const porBloco = new Map<string, OrderItem[]>();
  items.forEach((it) => {
    const nome = blockNameFor(it.code);
    porBloco.set(nome, [...(porBloco.get(nome) ?? []), it]);
  });

  const linhas: string[] = [];
  porBloco.forEach((its, nome) => {
    linhas.push(`_${nome}_`);
    its.forEach((it) => {
      const nome = stickerName(it.code);
      linhas.push(`• ${displayCode(it.code)}${nome ? ` ${nome}` : ""} — ${it.qty} × ${formatBRL(it.unit_cents)} = ${formatBRL(it.qty * it.unit_cents)}`);
    });
  });

  const catalog = catalogOfCodes(items.map((it) => it.code));
  const totalFigurinhas = items.reduce((s, it) => s + it.qty, 0);
  const itemLabel = totalFigurinhas === 1 ? catalog.itemSingular : catalog.itemPlural;
  const reservados = catalog.itemSingular === "card" ? "Cards reservados" : "Figurinhas reservadas";

  return [
    `*Pedido #${number} — ${catalog.shortName}*`,
    "",
    ...linhas,
    "",
    `*Total: ${formatBRL(totalCents)}* (${totalFigurinhas} ${itemLabel}) — frete a combinar`,
    ...(reservedUntil ? [`${reservados} até ${formatDateTimeBR(reservedUntil)}.`] : []),
    "",
    "*Comprador*",
    `Nome: ${buyer.name}`,
    `E-mail: ${buyer.email}`,
    `WhatsApp: ${buyer.whatsapp}`,
    `Endereço: ${formatAddress(buyer)}`,
  ].join("\n");
}
