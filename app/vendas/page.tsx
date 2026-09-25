import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_COLUMNS,
  availableFromQty,
  groupPricesFromRow,
  orderFromRow,
  settingsFromRow,
  type OrderRow,
  type ShopRow,
} from "@/lib/shop";
import { hasShopAccess } from "@/lib/shopAccess";
import NoticeCard from "@/components/NoticeCard";
import ShopAdmin from "@/components/ShopAdmin";
import type { Qtd } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loja e pedidos — Álbum Copa 2026",
};

const SHOP_COLUMNS =
  "token, enabled, seller_name, whatsapp, min_order_cents, price_fwc_cents, price_team_cents, price_cc_cents, price_leg_cents";

export default async function VendasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await hasShopAccess(supabase, user.id))) {
    return (
      <NoticeCard kicker="Loja" backHref="/" backLabel="← Meu álbum">
        A loja de figurinhas ainda não está disponível para a sua conta.
      </NoticeCard>
    );
  }

  let { data: shop } = await supabase
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle<ShopRow>();

  // Primeira visita: cria a loja (desativada até o dono configurar WhatsApp e preços).
  if (!shop) {
    await supabase
      .from("shops")
      .upsert(
        { user_id: user.id, token: randomUUID().replace(/-/g, ""), enabled: false },
        { onConflict: "user_id", ignoreDuplicates: true }
      );
    ({ data: shop } = await supabase
      .from("shops")
      .select(SHOP_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle<ShopRow>());
  }

  if (!shop) {
    throw new Error("Não foi possível criar a loja — confira se a migração supabase_migration_shop.sql foi aplicada.");
  }

  // Pedidos novos com a reserva vencida viram "cancelado (expirado)" antes de listar.
  await supabase.rpc("expire_orders", { p_seller: user.id });

  const [{ data: priceRows }, { data: orderRows }, { data: collectionRows }] = await Promise.all([
    supabase.from("sticker_prices").select("code, price_cents").eq("user_id", user.id),
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("collection").select("code, qty").eq("user_id", user.id),
  ]);

  const individual: Record<string, number> = {};
  (priceRows ?? []).forEach((r) => {
    individual[r.code as string] = r.price_cents as number;
  });

  // Estoque bruto (repetidas). As reservas saem dos pedidos novos, calculadas no cliente.
  const available: Qtd = {};
  (collectionRows ?? []).forEach((r) => {
    const n = availableFromQty(r.qty as number);
    if (n > 0) available[r.code as string] = n;
  });

  return (
    <ShopAdmin
      userId={user.id}
      initialSettings={settingsFromRow(shop)}
      initialGroupPrices={groupPricesFromRow(shop)}
      initialIndividual={individual}
      initialOrders={((orderRows ?? []) as OrderRow[]).map(orderFromRow)}
      initialAvailable={available}
    />
  );
}
