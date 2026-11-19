import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { LEGEND_CODES, LOT_COLUMNS, lotFromRow, type LegendCount, type PackLot, type PackLotRow } from "./packs";
import { FUNNEL_STEPS, type FunnelSource, type FunnelStep } from "./packFunnel";
import { hasShopAccess } from "./shopAccess";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

// Lotes de pacotes: acesso e leitura no servidor. As escritas passam pela service_role (actions), sempre
// depois de packSeller() — a tela não é barreira de segurança.

/** Lojista da sessão liberado para vender pacotes (pack_access + loja em dia), ou null. */
export async function packSeller(): Promise<{ user: User; supabase: SupabaseClient } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: access }, shop] = await Promise.all([
    supabase.from("pack_access").select("user_id").eq("user_id", user.id).maybeSingle(),
    hasShopAccess(supabase, user.id),
  ]);
  return access && shop ? { user, supabase } : null;
}

/** Se o usuário pode vender pacotes — para mostrar o atalho no painel da loja. */
export async function hasPackAccess(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await client.from("pack_access").select("user_id").eq("user_id", userId).maybeSingle();
  return !!data;
}

export interface LotSummary extends PackLot {
  /** Legends no pote = número de pacotes. */
  legends: number;
}

export async function listLots(client: SupabaseClient, sellerId: string): Promise<LotSummary[]> {
  const { data } = await client
    .from("pack_lots")
    .select(`${LOT_COLUMNS}, pack_lot_legends(count)`)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as (PackLotRow & { pack_lot_legends: { count: number }[] })[]).map((r) => ({
    ...lotFromRow(r),
    legends: r.pack_lot_legends?.[0]?.count ?? 0,
  }));
}

export interface LotDetail {
  lot: PackLot;
  /** Unidades no pote por código. */
  pot: LegendCount;
  /** Repetidas livres por código (qty - 1 - reservas), para colocar no pote. */
  available: LegendCount;
  /** Endereço da loja (para o link público) e pedido mínimo da loja. */
  shopSlug: string | null;
  shopMinOrderCents: number;
}

export async function loadLot(client: SupabaseClient, sellerId: string, id: string): Promise<LotDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: row } = await client
    .from("pack_lots")
    .select(LOT_COLUMNS)
    .eq("id", id)
    .eq("seller_id", sellerId)
    .maybeSingle<PackLotRow>();
  if (!row) return null;

  const [{ data: legends }, { data: collection }, { data: reserved }, { data: shop }] = await Promise.all([
    client.from("pack_lot_legends").select("code").eq("lot_id", id).limit(1000),
    client.from("collection").select("code, qty").eq("user_id", sellerId).in("code", [...LEGEND_CODES]),
    client.rpc("reserved_qty", { p_seller: sellerId }),
    client.from("shops").select("slug, order_min_cents").eq("user_id", sellerId).maybeSingle<{ slug: string | null; order_min_cents: number | null }>(),
  ]);

  const pot: LegendCount = {};
  for (const l of (legends ?? []) as { code: string }[]) pot[l.code] = (pot[l.code] ?? 0) + 1;

  const held: LegendCount = {};
  for (const r of (reserved ?? []) as { code: string; qty: number }[]) if (LEGEND_CODES.has(r.code)) held[r.code] = r.qty;
  const available: LegendCount = {};
  for (const c of (collection ?? []) as { code: string; qty: number }[]) {
    const n = Math.max(c.qty - 1, 0) - (held[c.code] ?? 0);
    if (n > 0) available[c.code] = n;
  }

  return {
    lot: lotFromRow(row),
    pot,
    available,
    shopSlug: shop?.slug ?? null,
    shopMinOrderCents: shop?.order_min_cents ?? 0,
  };
}

export interface LotFunnel {
  /** Pessoas em cada etapa. */
  total: Record<FunnelStep, number>;
  /** Pessoas em cada etapa, por origem da primeira visita (só origens com alguma visita). */
  bySource: { source: FunnelSource; steps: Record<FunnelStep, number> }[];
  /** Visitantes nas últimas 24h. */
  last24h: number;
}

/** Funil da página do lote. Chamar só depois de confirmar que o lote é do lojista (loadLot). */
export async function loadFunnel(lotId: string): Promise<LotFunnel> {
  const zero = () => Object.fromEntries(FUNNEL_STEPS.map((s) => [s, 0])) as Record<FunnelStep, number>;
  const total = zero();
  const src = new Map<FunnelSource, Record<FunnelStep, number>>();
  const firstSource = new Map<string, FunnelSource>();
  let last24h = 0;
  const since = Date.now() - 86_400_000;
  const rows: { visitor: string; step: FunnelStep; source: FunnelSource; created_at: string }[] = [];
  const admin = createAdminClient();
  for (let from = 0; ; from += 1000) {
    const { data } = await admin
      .from("pack_lot_events")
      .select("visitor, step, source, created_at")
      .eq("lot_id", lotId)
      .order("created_at")
      .range(from, from + 999);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  // A origem de cada pessoa é a da primeira etapa registrada (normalmente a visita).
  for (const r of rows) if (!firstSource.has(r.visitor)) firstSource.set(r.visitor, r.source);
  for (const r of rows) {
    total[r.step]++;
    const s = firstSource.get(r.visitor) ?? r.source;
    if (!src.has(s)) src.set(s, zero());
    src.get(s)![r.step]++;
    if (r.step === "view" && Date.parse(r.created_at) >= since) last24h++;
  }
  const bySource = [...src.entries()].map(([source, steps]) => ({ source, steps })).sort((a, b) => b.steps.view - a.steps.view);
  return { total, bySource, last24h };
}
