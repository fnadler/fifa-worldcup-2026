import "server-only";
import type { User } from "@supabase/supabase-js";
import { isAdmin } from "./adminStats";
import {
  AUCTION_COLUMNS,
  AUCTION_IMAGE_BUCKET,
  LOT_COLUMNS,
  auctionFromRow,
  lotFromRow,
  type Auction,
  type AuctionLot,
  type AuctionRow,
  type LotRow,
} from "./auctions";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

// Leilões: leitura e checagem de acesso no servidor. As tabelas não têm políticas de RLS — tudo passa
// pela service_role, então a checagem de admin vem SEMPRE antes de qualquer leitura ou gravação.

/** Usuário admin da sessão, ou null (sem sessão ou não é admin). */
export async function adminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && isAdmin(user) ? user : null;
}

const SIGNED_URL_SECONDS = 60 * 60 * 6; // cobre um leilão inteiro com a página aberta

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await createAdminClient().storage.from(AUCTION_IMAGE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const out: Record<string, string> = {};
  for (const s of data ?? []) if (s.path && s.signedUrl) out[s.path] = s.signedUrl;
  return out;
}

export interface AuctionSummary extends Auction {
  lots: number;
  sold: number;
  startTotalCents: number;
  soldTotalCents: number;
}

export async function listAuctions(): Promise<AuctionSummary[]> {
  const admin = createAdminClient();
  const [{ data: auctions, error }, { data: lots }] = await Promise.all([
    admin.from("auctions").select(AUCTION_COLUMNS).order("starts_at", { ascending: false }).returns<AuctionRow[]>(),
    admin.from("auction_lots").select("auction_id, start_cents, status, sold_cents"),
  ]);
  if (error) throw error;
  return (auctions ?? []).map((r) => {
    const own = (lots ?? []).filter((l) => l.auction_id === r.id);
    const sold = own.filter((l) => l.status === "arrematado");
    return {
      ...auctionFromRow(r),
      lots: own.length,
      sold: sold.length,
      startTotalCents: own.reduce((s, l) => s + l.start_cents, 0),
      soldTotalCents: sold.reduce((s, l) => s + (l.sold_cents ?? 0), 0),
    };
  });
}

export async function loadAuction(id: string): Promise<{ auction: Auction; lots: AuctionLot[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = createAdminClient();
  const [{ data: a }, { data: lots, error }] = await Promise.all([
    admin.from("auctions").select(AUCTION_COLUMNS).eq("id", id).maybeSingle<AuctionRow>(),
    admin.from("auction_lots").select(LOT_COLUMNS).eq("auction_id", id).order("position").order("created_at").returns<LotRow[]>(),
  ]);
  if (!a) return null;
  if (error) throw error;
  const urls = await signedUrls((lots ?? []).flatMap((l) => (l.image_path ? [l.image_path] : [])));
  return {
    auction: auctionFromRow(a),
    lots: (lots ?? []).map((l) => lotFromRow(l, l.image_path ? (urls[l.image_path] ?? null) : null)),
  };
}

/** Configurações do leilão mais recente, para começar um novo com os mesmos valores. */
export async function lastAuctionDefaults(): Promise<Partial<Auction>> {
  const { data } = await createAdminClient()
    .from("auctions")
    .select(AUCTION_COLUMNS)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle<AuctionRow>();
  if (!data) return {};
  const a = auctionFromRow(data);
  return {
    lotMinutes: a.lotMinutes,
    extensionMinutes: a.extensionMinutes,
    minIncrementCents: a.minIncrementCents,
    pixKey: a.pixKey,
    pixDeadlineHours: a.pixDeadlineHours,
    shippingNote: a.shippingNote,
  };
}
