import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CART_COOKIE, readCartId } from "@/lib/cartCookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOO_MANY, withinRateLimit, type RateRule } from "@/lib/rateLimit";
import { loadShopForOrder, validItemCode } from "@/lib/shopCart";
import {
  isProductCode,
  isValidPhoneBR,
  onlyDigits,
  orderMessage,
  priceFor,
  whatsappLink,
  type BuyerInfo,
  type OrderItem,
} from "@/lib/shop";

interface PedidoBody {
  items?: { code?: unknown; qty?: unknown }[];
  buyer?: Partial<Record<keyof BuyerInfo, unknown>>;
  website?: unknown; // honeypot — humanos não veem esse campo
  ack?: unknown; // comprador marcou que leu as orientações de segurança
}

const REQUIRED: (keyof BuyerInfo)[] = ["name", "email", "whatsapp", "cep", "street", "number", "district", "city", "state"];

// Por IP: pedidos enviados (cada um segura o estoque do lojista por 24h).
const LIMITE: RateRule[] = [
  { name: "pedido", windowSeconds: 600, max: 8 },
  { name: "pedido-dia", windowSeconds: 86_400, max: 30 },
];

function str(v: unknown, max = 160): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function indisponivel(codes: string[]) {
  return NextResponse.json(
    { error: "Alguns itens não estão mais disponíveis. Ajuste o carrinho e tente de novo.", unavailable: codes },
    { status: 409 }
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: PedidoBody;
  try {
    body = (await request.json()) as PedidoBody;
  } catch {
    return bad("Requisição inválida.");
  }

  if (str(body.website)) return bad("Requisição inválida.");
  if (body.ack !== true) return bad("Confirme que leu as dicas de segurança para continuar.");

  // ---------- comprador ----------
  const buyer: BuyerInfo = {
    name: str(body.buyer?.name),
    email: str(body.buyer?.email),
    whatsapp: str(body.buyer?.whatsapp, 30),
    cep: str(body.buyer?.cep, 12),
    street: str(body.buyer?.street),
    number: str(body.buyer?.number, 20),
    complement: str(body.buyer?.complement),
    district: str(body.buyer?.district),
    city: str(body.buyer?.city),
    state: str(body.buyer?.state, 2).toUpperCase(),
  };
  if (REQUIRED.some((k) => !buyer[k])) return bad("Preencha todos os campos obrigatórios.");
  if (buyer.name.split(/\s+/).length < 2) return bad("Informe o nome completo.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) return bad("E-mail inválido.");
  if (!isValidPhoneBR(buyer.whatsapp)) return bad("WhatsApp inválido. Informe o DDD e o número: (11) 99999-8888.");
  if (onlyDigits(buyer.cep).length !== 8) return bad("CEP inválido.");
  if (!/^[A-Z]{2}$/.test(buyer.state)) return bad("UF inválida.");

  // ---------- itens (de qualquer coleção à venda e produtos da loja) ----------
  const pedidos = new Map<string, number>();
  for (const raw of body.items ?? []) {
    const code = typeof raw.code === "string" ? raw.code : "";
    const qty = typeof raw.qty === "number" ? raw.qty : NaN;
    if (!validItemCode(code) || !Number.isInteger(qty) || qty < 1 || qty > 99) return bad("Item inválido no carrinho.");
    pedidos.set(code, (pedidos.get(code) ?? 0) + qty);
  }
  if (!pedidos.size) return bad("O carrinho está vazio.");
  if (pedidos.size > 300) return bad("Carrinho grande demais.");

  // ---------- loja, estoque e preços (sempre recalculados aqui, nunca confiando no cliente) ----------
  const admin = createAdminClient();
  if (!(await withinRateLimit(admin, request, LIMITE))) return bad(TOO_MANY, 429);

  const found = await loadShopForOrder(admin, token, [...pedidos.keys()]);
  if (!found.ok) return bad(found.error, found.status);
  const { shop, pricing } = found;
  if (!shop.whatsapp) return bad("O anunciante ainda não configurou o WhatsApp da loja.", 409);

  const items: OrderItem[] = [];
  const semPreco: string[] = [];
  for (const [code, qty] of pedidos) {
    const unit = priceFor(code, pricing);
    if (unit === null) semPreco.push(code);
    // o título do produto fica guardado no pedido (o lojista pode editar ou apagar o produto depois)
    else items.push({ code, qty, unit_cents: unit, ...(isProductCode(code) ? { name: pricing.products?.[code]?.title } : {}) });
  }
  if (semPreco.length) return indisponivel(semPreco);

  const totalCents = items.reduce((s, it) => s + it.qty * it.unit_cents, 0);
  if (totalCents < (shop.order_min_cents ?? 0)) return bad("O pedido não atingiu o valor mínimo.");

  // Estoque (repetidas - reservas de outros pedidos) é checado e reservado atomicamente no banco.
  // O carrinho do próprio comprador não conta como reserva de terceiros (e vira o pedido).
  const cartId = readCartId((await cookies()).get(CART_COOKIE)?.value);
  const { data: placed, error } = await admin
    .rpc("place_shop_order", {
      p_seller: shop.user_id,
      p_items: items,
      p_total_cents: totalCents,
      p_buyer: buyer,
      p_cart_id: cartId,
    })
    .single<{ id: string; number: number; reserved_until: string }>();

  if (error?.message.startsWith("INDISPONIVEL:")) {
    return indisponivel(error.message.slice("INDISPONIVEL:".length).split(","));
  }
  if (error || !placed) return bad("Não foi possível registrar o pedido — tente de novo.", 500);

  // Registro de que o comprador leu as orientações (e o aviso de responsabilidade) antes de pedir.
  await admin.from("orders").update({ buyer_ack_at: new Date().toISOString() }).eq("id", placed.id);

  const message = orderMessage(placed.number, items, totalCents, buyer, placed.reserved_until);
  return NextResponse.json({
    number: placed.number,
    reservedUntil: placed.reserved_until,
    whatsappUrl: whatsappLink(shop.whatsapp, message),
  });
}
