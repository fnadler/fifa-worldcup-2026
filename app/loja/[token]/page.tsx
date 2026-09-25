import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { availableFromQty, groupPricesFromRow, type ShopRow } from "@/lib/shop";
import { hasShopAccess } from "@/lib/shopAccess";
import NoticeCard from "@/components/NoticeCard";
import ShopBoard from "@/components/ShopBoard";
import type { Qtd } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loja — Álbum Copa 2026",
  description: "Compre figurinhas avulsas do álbum da Copa 2026.",
};

export default async function LojaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: shop } = await admin
    .from("shops")
    .select("user_id, token, enabled, seller_name, whatsapp, min_order_cents, price_fwc_cents, price_team_cents, price_cc_cents, price_leg_cents")
    .eq("token", token)
    .maybeSingle<ShopRow & { user_id: string }>();

  if (!shop) notFound();

  // Loja desligada pelo dono ou acesso à vitrine vencido/revogado: mesma tela para o comprador.
  if (!shop.enabled || !(await hasShopAccess(admin, shop.user_id))) {
    return (
      <NoticeCard kicker="Loja pausada">
        Esta loja não está recebendo pedidos no momento. Volte mais tarde!
      </NoticeCard>
    );
  }

  await admin.rpc("expire_orders", { p_seller: shop.user_id });

  const [{ data: rows }, { data: priceRows }, { data: reservedRows }] = await Promise.all([
    admin.from("collection").select("code, qty").eq("user_id", shop.user_id),
    admin.from("sticker_prices").select("code, price_cents").eq("user_id", shop.user_id),
    admin.rpc("reserved_qty", { p_seller: shop.user_id }),
  ]);

  const reserved = new Map(
    ((reservedRows ?? []) as { code: string; qty: number }[]).map((r) => [r.code, r.qty])
  );

  // Só a disponibilidade vai para o cliente — nunca o qty bruto nem o WhatsApp do anunciante.
  // Disponível = repetidas menos o que está reservado em pedidos ainda não confirmados.
  const available: Qtd = {};
  (rows ?? []).forEach((row) => {
    const n = availableFromQty(row.qty as number) - (reserved.get(row.code as string) ?? 0);
    if (n > 0) available[row.code as string] = n;
  });

  const individual: Record<string, number> = {};
  (priceRows ?? []).forEach((row) => {
    individual[row.code as string] = row.price_cents as number;
  });

  return (
    <ShopBoard
      token={token}
      sellerName={shop.seller_name ?? ""}
      minOrderCents={shop.min_order_cents}
      available={available}
      pricing={{ group: groupPricesFromRow(shop), individual }}
    />
  );
}
