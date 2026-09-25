import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasShopAccess } from "@/lib/shopAccess";
import {
  groupPricesFromRow,
  isKnownCode,
  onlyDigits,
  orderMessage,
  priceFor,
  whatsappLink,
  type BuyerInfo,
  type OrderItem,
  type ShopRow,
} from "@/lib/shop";

interface PedidoBody {
  items?: { code?: unknown; qty?: unknown }[];
  buyer?: Partial<Record<keyof BuyerInfo, unknown>>;
  website?: unknown; // honeypot — humanos não veem esse campo
}

const REQUIRED: (keyof BuyerInfo)[] = ["name", "email", "whatsapp", "cep", "street", "number", "district", "city", "state"];

function str(v: unknown, max = 160): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function indisponivel(codes: string[]) {
  return NextResponse.json(
    { error: `Não há mais disponibilidade para: ${codes.join(", ")}. Ajuste o carrinho e tente de novo.`, unavailable: codes },
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
  const whatsDigits = onlyDigits(buyer.whatsapp).length;
  if (whatsDigits < 10 || whatsDigits > 13) return bad("Número de WhatsApp inválido.");
  if (onlyDigits(buyer.cep).length !== 8) return bad("CEP inválido.");
  if (!/^[A-Z]{2}$/.test(buyer.state)) return bad("UF inválida.");

  // ---------- itens ----------
  const pedidos = new Map<string, number>();
  for (const raw of body.items ?? []) {
    const code = typeof raw.code === "string" ? raw.code : "";
    const qty = typeof raw.qty === "number" ? raw.qty : NaN;
    if (!isKnownCode(code) || !Number.isInteger(qty) || qty < 1 || qty > 99) return bad("Item inválido no carrinho.");
    pedidos.set(code, (pedidos.get(code) ?? 0) + qty);
  }
  if (!pedidos.size) return bad("O carrinho está vazio.");

  // ---------- loja, estoque e preços (sempre recalculados aqui, nunca confiando no cliente) ----------
  const admin = createAdminClient();
  const { data: shop } = await admin
    .from("shops")
    .select("user_id, token, enabled, seller_name, whatsapp, min_order_cents, price_fwc_cents, price_team_cents, price_cc_cents, price_leg_cents")
    .eq("token", token)
    .maybeSingle<ShopRow & { user_id: string }>();

  if (!shop) return bad("Loja não encontrada.", 404);
  if (!shop.enabled || !(await hasShopAccess(admin, shop.user_id))) return bad("Esta loja não está recebendo pedidos no momento.", 409);
  if (!shop.whatsapp) return bad("O anunciante ainda não configurou o WhatsApp da loja.", 409);

  const codes = [...pedidos.keys()];
  const { data: priceRows } = await admin
    .from("sticker_prices")
    .select("code, price_cents")
    .eq("user_id", shop.user_id)
    .in("code", codes);

  const individual: Record<string, number> = {};
  (priceRows ?? []).forEach((r) => {
    individual[r.code as string] = r.price_cents as number;
  });
  const pricing = { group: groupPricesFromRow(shop), individual };

  const items: OrderItem[] = [];
  const semPreco: string[] = [];
  for (const [code, qty] of pedidos) {
    const unit = priceFor(code, pricing);
    if (unit === null) semPreco.push(code);
    else items.push({ code, qty, unit_cents: unit });
  }
  if (semPreco.length) return indisponivel(semPreco);

  const totalCents = items.reduce((s, it) => s + it.qty * it.unit_cents, 0);
  if (totalCents < shop.min_order_cents) return bad("O pedido não atingiu o valor mínimo.");

  // Estoque (repetidas - reservas de outros pedidos) é checado e reservado atomicamente no banco.
  const { data: placed, error } = await admin
    .rpc("place_order", { p_seller: shop.user_id, p_items: items, p_total_cents: totalCents, p_buyer: buyer })
    .single<{ id: string; number: number; reserved_until: string }>();

  if (error?.message.startsWith("INDISPONIVEL:")) {
    return indisponivel(error.message.slice("INDISPONIVEL:".length).split(","));
  }
  if (error || !placed) return bad("Não foi possível registrar o pedido — tente de novo.", 500);

  const message = orderMessage(placed.number, items, totalCents, buyer, placed.reserved_until);
  return NextResponse.json({
    number: placed.number,
    reservedUntil: placed.reserved_until,
    whatsappUrl: whatsappLink(shop.whatsapp, message),
  });
}
