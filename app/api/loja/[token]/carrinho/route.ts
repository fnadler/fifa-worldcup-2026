import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CART_COOKIE, CART_COOKIE_OPTIONS, readCartId } from "@/lib/cartCookie";
import { TOO_MANY, withinRateLimit, type RateRule } from "@/lib/rateLimit";
import { CARRINHO_MINUTOS, priceFor } from "@/lib/shop";
import { loadShopForOrder, validItemCode } from "@/lib/shopCart";
import { createAdminClient } from "@/lib/supabase/admin";

// Por IP: alterações de carrinho (cada clique agrupado vira uma chamada) e carrinhos novos (chamadas
// sem o cookie do carrinho — é assim que um script reservaria o estoque várias vezes).
const LIMITE: RateRule[] = [{ name: "carrinho", windowSeconds: 60, max: 120 }];
const LIMITE_NOVO: RateRule[] = [{ name: "carrinho-novo", windowSeconds: 600, max: 20 }];

// Reserva o carrinho do navegador nesta loja por CARRINHO_MINUTOS (prazo contado do primeiro item, sem
// renovar a cada alteração). Um carrinho só, com itens de qualquer coleção à venda e produtos. Cada
// item é ajustado ao que estiver disponível; a resposta traz o que foi reservado e o que foi ajustado.
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
    if (!validItemCode(code) || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return NextResponse.json({ error: "Item inválido no carrinho." }, { status: 400 });
    }
    pedidos.set(code, (pedidos.get(code) ?? 0) + qty);
  }
  if (pedidos.size > 300) return NextResponse.json({ error: "Carrinho grande demais." }, { status: 400 });

  const admin = createAdminClient();
  const cookieStore = await cookies();
  let cartId = readCartId(cookieStore.get(CART_COOKIE)?.value);
  const novoCookie = !cartId;
  if (!(await withinRateLimit(admin, request, novoCookie ? [...LIMITE, ...LIMITE_NOVO] : LIMITE))) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  }

  const found = await loadShopForOrder(admin, token, [...pedidos.keys()]);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const { shop, pricing } = found;

  // Só itens com preço (coleção à venda com preço, ou produto ativo) entram na reserva.
  const items = [...pedidos].filter(([code]) => priceFor(code, pricing) !== null).map(([code, qty]) => ({ code, qty }));

  if (!cartId) cartId = randomUUID();

  const { data: held, error } = await admin
    .rpc("hold_shop_cart", { p_seller: shop.user_id, p_cart_id: cartId, p_items: items, p_minutes: CARRINHO_MINUTOS })
    .single<{ items: { code: string; qty: number }[]; expires_at: string | null }>();
  if (error || !held) {
    if (error) console.error("[loja/carrinho]", error.message);
    return NextResponse.json({ error: "Não foi possível reservar o carrinho — tente de novo." }, { status: 500 });
  }

  const granted = new Map(held.items.map((i) => [i.code, i.qty]));
  const adjusted = [...pedidos]
    .filter(([code, qty]) => (granted.get(code) ?? 0) < qty)
    .map(([code, requested]) => ({ code, requested, granted: granted.get(code) ?? 0 }));

  const res = NextResponse.json({ items: held.items, expiresAt: held.expires_at, adjusted });
  if (novoCookie) res.cookies.set(CART_COOKIE, cartId, CART_COOKIE_OPTIONS);
  return res;
}
