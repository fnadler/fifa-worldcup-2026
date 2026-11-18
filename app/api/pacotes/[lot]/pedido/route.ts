import { NextResponse } from "next/server";
import { isValidCPF } from "@/lib/cpf";
import { LOT_MAX_PACKS } from "@/lib/packs";
import { TOO_MANY, withinRateLimit, type RateRule } from "@/lib/rateLimit";
import { isValidPhoneBR, onlyDigits, orderMessage, whatsappLink, type BuyerInfo, type OrderItem } from "@/lib/shop";
import { hasShopAccess } from "@/lib/shopAccess";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Pedido de pacotes de um lote: reserva os números escolhidos e sorteia, no banco, as 7 figurinhas de cada
// pacote. O comprador não vê as figurinhas (nem a Legend, que só sai na abertura).

interface PedidoBody {
  numbers?: unknown;
  buyer?: Partial<Record<keyof BuyerInfo, unknown>>;
  website?: unknown; // honeypot
  ack?: unknown;
}

const REQUIRED: (keyof BuyerInfo)[] = ["name", "email", "whatsapp", "cpf", "cep", "street", "number", "district", "city", "state"];

// Mesmos limites do pedido da loja: cada pedido segura pacotes e figurinhas por 24h.
const LIMITE: RateRule[] = [
  { name: "pedido", windowSeconds: 600, max: 8 },
  { name: "pedido-dia", windowSeconds: 86_400, max: 30 },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max = 160): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function bad(error: string, status = 400, extra?: object) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ lot: string }> }) {
  const { lot: lotId } = await params;
  if (!UUID.test(lotId)) return bad("Lote não encontrado.", 404);

  let body: PedidoBody;
  try {
    body = (await request.json()) as PedidoBody;
  } catch {
    return bad("Requisição inválida.");
  }
  if (str(body.website)) return bad("Requisição inválida.");
  if (body.ack !== true) return bad("Confirme que leu as dicas de segurança para continuar.");

  const buyer: BuyerInfo = {
    name: str(body.buyer?.name),
    email: str(body.buyer?.email),
    whatsapp: str(body.buyer?.whatsapp, 30),
    cpf: onlyDigits(str(body.buyer?.cpf, 20)),
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
  if (!isValidCPF(buyer.cpf)) return bad("CPF inválido. Confira os números.");
  if (onlyDigits(buyer.cep).length !== 8) return bad("CEP inválido.");
  if (!/^[A-Z]{2}$/.test(buyer.state)) return bad("UF inválida.");

  const raw = Array.isArray(body.numbers) ? body.numbers : [];
  const numbers = [...new Set(raw.filter((n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 999))];
  if (!numbers.length || numbers.length !== raw.length || numbers.length > LOT_MAX_PACKS) return bad("Escolha os pacotes de novo.");

  const admin = createAdminClient();
  if (!(await withinRateLimit(admin, request, LIMITE))) return bad(TOO_MANY, 429);

  const { data: lot } = await admin
    .from("pack_lots")
    .select("id, seller_id, title, price_cents, min_order_cents, status")
    .eq("id", lotId)
    .maybeSingle<{ id: string; seller_id: string; title: string; price_cents: number; min_order_cents: number | null; status: string }>();
  if (!lot) return bad("Lote não encontrado.", 404);

  const [{ data: shop }, { data: access }, shopOk] = await Promise.all([
    admin
      .from("shops")
      .select("enabled, whatsapp, order_min_cents")
      .eq("user_id", lot.seller_id)
      .maybeSingle<{ enabled: boolean; whatsapp: string | null; order_min_cents: number | null }>(),
    admin.from("pack_access").select("user_id").eq("user_id", lot.seller_id).maybeSingle(),
    hasShopAccess(admin, lot.seller_id),
  ]);
  if (!shop || !shop.enabled || !access || !shopOk || lot.status !== "ativo") {
    return bad("Este lote não está recebendo pedidos no momento.", 409);
  }
  if (!shop.whatsapp) return bad("A loja ainda não configurou o WhatsApp.", 409);

  const totalCents = numbers.length * lot.price_cents;
  const minimo = lot.min_order_cents ?? shop.order_min_cents ?? 0;
  if (totalCents < minimo) return bad("O pedido não atingiu o valor mínimo.");

  // Conta da sessão: o sorteio evita figurinhas que a pessoa já tem (sem sessão, o banco procura pelo e-mail).
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();

  const { data: placed, error } = await admin
    .rpc("place_pack_order", {
      p_seller: lot.seller_id,
      p_lot: lot.id,
      p_numbers: numbers,
      p_buyer: buyer,
      p_buyer_user: user?.id ?? null,
    })
    .single<{ id: string; number: number; reserved_until: string; pack_token: string }>();

  if (error?.message.startsWith("OCUPADOS:")) {
    const taken = error.message.slice("OCUPADOS:".length).split(",").map(Number);
    return bad(
      taken.length === 1 ? "Esse pacote acabou de ser reservado por outra pessoa." : "Alguns pacotes acabaram de ser reservados por outras pessoas.",
      409,
      { taken }
    );
  }
  if (error?.message.includes("LOTE_FECHADO")) return bad("Este lote não está recebendo pedidos no momento.", 409);
  if (error?.message.includes("SEM_FIGURINHAS"))
    return bad("No momento não há figurinhas suficientes para montar esses pacotes. Tente menos pacotes ou fale com a loja.", 409);
  if (error || !placed) return bad("Não foi possível registrar o pedido — tente de novo.", 500);

  const { data: ack } = await admin
    .from("orders")
    .update({ buyer_ack_at: new Date().toISOString(), buyer_cpf: buyer.cpf })
    .eq("id", placed.id)
    .select("code, items")
    .single<{ code: string; items: OrderItem[] }>();
  const code = ack?.code ?? String(placed.number);
  const items = ack?.items ?? [];

  const message = orderMessage(code, items, totalCents, buyer, placed.reserved_until);
  return NextResponse.json({
    code,
    numbers: numbers.sort((a, b) => a - b),
    reservedUntil: placed.reserved_until,
    whatsappUrl: whatsappLink(shop.whatsapp, message),
  });
}
