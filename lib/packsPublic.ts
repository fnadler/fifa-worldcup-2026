import "server-only";
import { DEFAULT_SHOP_NAME } from "./brand";
import { LOT_COLUMNS, lotFromRow, type LegendCount, type PackLot, type PackLotRow } from "./packs";
import { hasShopAccess } from "./shopAccess";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

// Página pública do lote (/<loja>/pacotes/<lote>): leitura pelo servidor (service_role), mostrando só o
// que é público — a situação de cada pacote. Enquanto houver Legend no pote, nada indica quais já saíram
// (para não desanimar quem ainda vai comprar); quando o pote esvazia, cada pacote aberto mostra a Legend,
// o primeiro nome e a cidade de quem abriu.

export type PublicPackState = "free" | "res" | "sold" | "open";

export interface PublicPack {
  n: number;
  state: PublicPackState;
  /** Só depois que o lote revela o resultado (pote vazio). */
  legend?: string;
  /** Primeiro nome e "Cidade/UF" de quem abriu (só pacotes abertos). */
  who?: { first: string; place: string };
  openedAt?: string;
}

export interface PublicShop {
  name: string;
  slug: string;
  logoUrl: string | null;
  /** Loja oficial: topo verde com o logo da plataforma. */
  official: boolean;
}

export interface PublicLot {
  shop: PublicShop;
  lot: PackLot;
  packs: PublicPack[];
  /** Todas as unidades do pote. */
  pot: { all: LegendCount };
  /** Todas as Legends já saíram: a grade mostra a Legend e quem abriu cada pacote. */
  revealed: boolean;
  minOrderCents: number;
  /** Lote à venda e já começou. */
  salesOpen: boolean;
  /** O dono vendo o próprio lote (em rascunho ou pausado, só ele vê). */
  isOwner: boolean;
}

interface PackRow {
  number: number;
  opened_at: string | null;
  legend_code: string | null;
  order: { status: string; reserved_until: string; buyer_name: string; address_city: string; address_state: string } | null;
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

async function findShop(slug: string) {
  const { data } = await createAdminClient()
    .from("shops")
    .select("user_id, slug, seller_name, logo_url, enabled")
    .eq("slug", slug)
    .maybeSingle<{ user_id: string; slug: string; seller_name: string | null; logo_url: string | null; enabled: boolean }>();
  return data;
}

export async function publicLotMeta(shopSlug: string, lotSlug: string) {
  const shop = await findShop(shopSlug);
  if (!shop) return null;
  const { data } = await createAdminClient()
    .from("pack_lots")
    .select("title, description, image_url, status")
    .eq("seller_id", shop.user_id)
    .eq("slug", lotSlug)
    .maybeSingle<{ title: string; description: string; image_url: string | null; status: string }>();
  if (!data || data.status === "rascunho") return null;
  return { ...data, shopName: shop.seller_name || DEFAULT_SHOP_NAME };
}

/** null = não existe (ou não é visível para quem está vendo). */
export async function loadPublicLot(shopSlug: string, lotSlug: string): Promise<PublicLot | null> {
  const admin = createAdminClient();
  const shop = await findShop(shopSlug);
  if (!shop) return null;

  const [{ data: lotRow }, { data: access }, shopOk, { data: owner }, { data: shopMin }] = await Promise.all([
    admin.from("pack_lots").select(LOT_COLUMNS).eq("seller_id", shop.user_id).eq("slug", lotSlug).maybeSingle<PackLotRow>(),
    admin.from("pack_access").select("user_id").eq("user_id", shop.user_id).maybeSingle(),
    hasShopAccess(admin, shop.user_id),
    (await createClient()).auth.getUser(),
    admin.from("shops").select("order_min_cents").eq("user_id", shop.user_id).maybeSingle<{ order_min_cents: number | null }>(),
  ]);
  if (!lotRow || !access || !shopOk) return null;
  const lot = lotFromRow(lotRow);
  const isOwner = owner.user?.id === shop.user_id;
  const visible = isOwner || (shop.enabled && (lot.status === "ativo" || lot.status === "encerrado"));
  if (!visible) return null;

  const [{ data: packRows }, { data: legendRows }] = await Promise.all([
    admin
      .from("packs")
      .select("number, opened_at, legend_code, order:orders(status, reserved_until, buyer_name, address_city, address_state)")
      .eq("lot_id", lot.id)
      .order("number")
      .returns<PackRow[]>(),
    admin.from("pack_lot_legends").select("code, pack_id").eq("lot_id", lot.id).limit(1000),
  ]);

  const all: LegendCount = {};
  let potLeft = 0;
  for (const l of (legendRows ?? []) as { code: string; pack_id: string | null }[]) {
    all[l.code] = (all[l.code] ?? 0) + 1;
    if (!l.pack_id) potLeft++;
  }
  const revealed = (legendRows ?? []).length > 0 && potLeft === 0;

  const now = Date.now();
  const packs: PublicPack[] = (packRows ?? []).map((p) => {
    const o = p.order;
    if (p.opened_at && p.legend_code && o) {
      if (!revealed) return { n: p.number, state: "open" };
      return {
        n: p.number,
        state: "open",
        legend: p.legend_code,
        who: { first: firstName(o.buyer_name), place: `${o.address_city}/${o.address_state}` },
        openedAt: p.opened_at,
      };
    }
    if (o?.status === "confirmado") return { n: p.number, state: "sold" };
    if (o?.status === "novo" && Date.parse(o.reserved_until) > now) return { n: p.number, state: "res" };
    return { n: p.number, state: "free" };
  });

  const salesOpen = lot.status === "ativo" && shop.enabled && (!lot.startsAt || Date.parse(lot.startsAt) <= now);

  return {
    shop: { name: shop.seller_name || DEFAULT_SHOP_NAME, slug: shop.slug, logoUrl: shop.logo_url, official: shop.slug === "loja-oficial" },
    lot,
    packs,
    pot: { all },
    revealed,
    minOrderCents: lot.minOrderCents ?? shopMin?.order_min_cents ?? 0,
    salesOpen,
    isOwner,
  };
}

/** Lotes visíveis de uma loja, para /<loja>/pacotes. */
export async function listPublicLots(shopSlug: string): Promise<{ shopName: string; lots: { slug: string; title: string }[] } | null> {
  const shop = await findShop(shopSlug);
  if (!shop || !shop.enabled) return null;
  const { data } = await createAdminClient()
    .from("pack_lots")
    .select("slug, title, status")
    .eq("seller_id", shop.user_id)
    .in("status", ["ativo", "encerrado"])
    .order("created_at", { ascending: false });
  return { shopName: shop.seller_name || DEFAULT_SHOP_NAME, lots: (data ?? []).map((l) => ({ slug: l.slug, title: l.title })) };
}
