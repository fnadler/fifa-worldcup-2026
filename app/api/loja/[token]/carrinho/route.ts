import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CART_COOKIE, CART_COOKIE_OPTIONS, readCartId } from "@/lib/cartCookie";
import { CARRINHO_MINUTOS, groupPricesFromRow, isKnownCode, priceFor, type ShopRow } from "@/lib/shop";
import { hasShopAccess } from "@/lib/shopAccess";
import { createAdminClient } from "@/lib/supabase/admin";

// Reserva o carrinho do navegador por CARRINHO_MINUTOS (prazo contado do primeiro item, sem
// renovar a cada alteração). Cada item é ajustado ao que estiver disponível para este carrinho;
// a resposta traz o que foi reservado de fato e o que precisou ser ajustado.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: { items?: { code?: unknown; qty?: unknown }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const pedidos = new Map<string, number>();
  for (const raw of body.items ?? []) {
    const code = typeof raw.code === "string" ? raw.code : "";
    const qty = typeof raw.qty === "number" ? raw.qty : NaN;
    if (!isKnownCode(code) || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return NextResponse.json({ error: "Item inválido no carrinho." }, { status: 400 });
    }
    pedidos.set(code, (pedidos.get(code) ?? 0) + qty);
  }
  if (pedidos.size > 300) return NextResponse.json({ error: "Carrinho grande demais." }, { status: 400 });

  const admin = createAdminClient();
  const { data: shop } = await admin
    .from("shops")
    .select("user_id, token, enabled, seller_name, whatsapp, min_order_cents, price_fwc_cents, price_team_cents, price_cc_cents, price_leg_cents")
    .eq("token", token)
    .maybeSingle<ShopRow & { user_id: string }>();
  if (!shop) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
  if (!shop.enabled || !(await hasShopAccess(admin, shop.user_id))) {
    return NextResponse.json({ error: "Esta loja não está recebendo pedidos no momento." }, { status: 409 });
  }

  // Só itens com preço entram na reserva.
  const { data: priceRows } = await admin
    .from("sticker_prices")
    .select("code, price_cents")
    .eq("user_id", shop.user_id)
    .in("code", [...pedidos.keys()]);
  const individual: Record<string, number> = {};
  (priceRows ?? []).forEach((r) => (individual[r.code as string] = r.price_cents as number));
  const pricing = { group: groupPricesFromRow(shop), individual };
  const items = [...pedidos].filter(([code]) => priceFor(code, pricing) !== null).map(([code, qty]) => ({ code, qty }));

  const cookieStore = await cookies();
  let cartId = readCartId(cookieStore.get(CART_COOKIE)?.value);
  const novoCookie = !cartId;
  if (!cartId) cartId = randomUUID();

  const { data: held, error } = await admin
    .rpc("hold_cart", { p_seller: shop.user_id, p_cart_id: cartId, p_items: items, p_minutes: CARRINHO_MINUTOS })
    .single<{ items: { code: string; qty: number }[]; expires_at: string | null }>();
  if (error || !held) return NextResponse.json({ error: "Não foi possível reservar o carrinho — tente de novo." }, { status: 500 });

  const granted = new Map(held.items.map((i) => [i.code, i.qty]));
  const adjusted = [...pedidos]
    .filter(([code, qty]) => (granted.get(code) ?? 0) < qty)
    .map(([code, requested]) => ({ code, requested, granted: granted.get(code) ?? 0 }));

  const res = NextResponse.json({ items: held.items, expiresAt: held.expires_at, adjusted });
  if (novoCookie) res.cookies.set(CART_COOKIE, cartId, CART_COOKIE_OPTIONS);
  return res;
}
