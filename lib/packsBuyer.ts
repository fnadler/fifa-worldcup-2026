import "server-only";
import { DEFAULT_SHOP_NAME } from "./brand";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

// Página dos pacotes do comprador (/pacote/<token>). O token é o segredo: quem tem o link vê os pacotes
// do pedido. As figurinhas de um pacote só aparecem depois de ele ser aberto.

export type BuyerOrderState = "aguardando" | "pronto" | "cancelado";

export interface BuyerPack {
  number: number;
  opened: boolean;
  legend: string | null;
  /** Só depois de aberto. */
  commons: string[];
  /** Figurinhas já marcadas na coleção do comprador. */
  collected: boolean;
}

export interface BuyerPacks {
  token: string;
  code: string;
  state: BuyerOrderState;
  reservedUntil: string;
  buyerFirstName: string;
  lot: { title: string; slug: string } | null;
  shop: { name: string; slug: string | null; logoUrl: string | null };
  packs: BuyerPack[];
  /** Quem está vendo: sem sessão, a conta do pedido (pode marcar na coleção) ou outra conta. */
  viewer: "anon" | "buyer" | "other";
}

export const TOKEN = /^[0-9a-f]{32}$/;

export async function loadBuyerPacks(token: string): Promise<BuyerPacks | null> {
  if (!TOKEN.test(token)) return null;
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, code, status, reserved_until, buyer_name, buyer_email, buyer_user_id, seller_id")
    .eq("pack_token", token)
    .maybeSingle<{
      id: string;
      code: string;
      status: string;
      reserved_until: string;
      buyer_name: string;
      buyer_email: string;
      buyer_user_id: string | null;
      seller_id: string;
    }>();
  if (!order) return null;

  const [{ data: packRows }, { data: shop }, { data: auth }] = await Promise.all([
    admin
      .from("packs")
      .select("number, commons, legend_code, opened_at, collected_at, lot:pack_lots(title, slug)")
      .eq("order_id", order.id)
      .order("number")
      .returns<
        {
          number: number;
          commons: string[] | null;
          legend_code: string | null;
          opened_at: string | null;
          collected_at: string | null;
          lot: { title: string; slug: string } | null;
        }[]
      >(),
    admin
      .from("shops")
      .select("seller_name, slug, logo_url")
      .eq("user_id", order.seller_id)
      .maybeSingle<{ seller_name: string | null; slug: string | null; logo_url: string | null }>(),
    (await createClient()).auth.getUser(),
  ]);
  const user = auth.user;
  const viewer: BuyerPacks["viewer"] = !user
    ? "anon"
    : isBuyer(user, order)
      ? "buyer"
      : "other";

  const expired = order.status === "novo" && Date.parse(order.reserved_until) <= Date.now();
  const state: BuyerOrderState =
    order.status === "confirmado" ? "pronto" : order.status === "novo" && !expired ? "aguardando" : "cancelado";
  const rows = state === "cancelado" ? [] : (packRows ?? []);

  return {
    token,
    code: order.code,
    state,
    reservedUntil: order.reserved_until,
    buyerFirstName: order.buyer_name.trim().split(/\s+/)[0] ?? "",
    lot: packRows?.[0]?.lot ?? null,
    shop: { name: shop?.seller_name || DEFAULT_SHOP_NAME, slug: shop?.slug ?? null, logoUrl: shop?.logo_url ?? null },
    packs: rows.map((p) => ({
      number: p.number,
      opened: !!p.opened_at,
      legend: p.opened_at ? p.legend_code : null,
      commons: p.opened_at ? (p.commons ?? []) : [],
      collected: !!p.collected_at,
    })),
    viewer,
  };
}

/** A conta é a do pedido: a mesma conta registrada no pedido, ou o mesmo e-mail. */
export function isBuyer(user: { id: string; email?: string | null }, order: { buyer_user_id: string | null; buyer_email: string }): boolean {
  return order.buyer_user_id === user.id || (!!user.email && user.email.toLowerCase() === order.buyer_email.trim().toLowerCase());
}
