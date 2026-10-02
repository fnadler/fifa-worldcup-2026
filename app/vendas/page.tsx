import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_COLUMNS,
  availableFromQty,
  orderFromRow,
  settingsFromRow,
  type OrderRow,
  type ShopRow,
} from "@/lib/shop";
import { hasShopAccess } from "@/lib/shopAccess";
import ShopAdmin from "@/components/ShopAdmin";
import type { Qtd } from "@/lib/types";
import { PLATFORM_NAME } from "@/lib/brand";
import { fetchAll } from "@/lib/fetchAll";
import { loadShopAlbums } from "@/lib/shopAlbums";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Configurações da loja — ${PLATFORM_NAME}`,
};

const SHOP_COLUMNS =
  "token, slug, logo_url, only_available, enabled, seller_name, whatsapp";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<{ assinatura?: string; aba?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Sem assinatura (ou vencida): página de assinatura.
  if (!(await hasShopAccess(supabase, user.id))) redirect("/assinar");

  let { data: shop } = await supabase
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle<ShopRow>();

  // Primeira visita: cria a loja (desativada até o dono configurar WhatsApp e preços).
  // Obs.: o Next memoriza GETs idênticos na mesma renderização — repetir o select acima
  // depois do insert devolveria o resultado antigo (sem loja). Por isso usamos o retorno do
  // próprio insert e, se outra aba criou a loja ao mesmo tempo (23505), um select diferente.
  let createError: string | null = null;
  if (!shop) {
    const { data: created, error } = await supabase
      .from("shops")
      .insert({ user_id: user.id, token: randomUUID().replace(/-/g, ""), enabled: false })
      .select(SHOP_COLUMNS)
      .single<ShopRow>();
    if (created) {
      shop = created;
    } else if (error?.code === "23505") {
      ({ data: shop } = await supabase
        .from("shops")
        .select(SHOP_COLUMNS)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle<ShopRow>());
    } else {
      createError = error ? `${error.code}: ${error.message}` : null;
    }
  }

  if (!shop) {
    console.error("[vendas] falha ao criar a loja", user.id, createError);
    throw new Error(`Não foi possível criar a loja${createError ? ` (${createError})` : ""}.`);
  }

  // Pedidos novos com a reserva vencida viram "cancelado (expirado)" antes de listar.
  await supabase.rpc("expire_orders", { p_seller: user.id });

  const [{ data: priceRows }, { data: orderRows }, { data: collectionRows }, albums] = await Promise.all([
    fetchAll<{ code: string; price_cents: number }>((from, to) =>
      supabase.from("sticker_prices").select("code, price_cents").eq("user_id", user.id).order("code").range(from, to)
    ),
    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    fetchAll<{ code: string; qty: number }>((from, to) =>
      supabase.from("collection").select("code, qty").eq("user_id", user.id).gt("qty", 1).order("code").range(from, to)
    ),
    loadShopAlbums(supabase, user.id),
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
      email={user.email ?? null}
      welcome={(await searchParams).assinatura === "ok"}
      initialTab={(await searchParams).aba}
      initialSettings={settingsFromRow(shop)}
      initialAlbums={albums}
      initialIndividual={individual}
      initialOrders={((orderRows ?? []) as OrderRow[]).map(orderFromRow)}
      initialAvailable={available}
    />
  );
}
