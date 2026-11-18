import { NextResponse } from "next/server";
import { DEFAULT_SHOP_NAME } from "@/lib/brand";
import { packsReadyHtml, packsReadySubject, packsReadyText } from "@/lib/email/packsReady";
import { emailConfigured, sendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// E-mail "seus pacotes estão prontos": o painel chama depois de confirmar um pedido de pacotes.
// Só o lojista dono do pedido; um envio por pedido (force = reenviar, no máximo a cada 10 minutos).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REENVIO_MS = 10 * 60_000;

export async function POST(request: Request) {
  let body: { orderId?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!UUID.test(orderId)) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });

  // RLS: o lojista só lê os próprios pedidos.
  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, code, status, buyer_name, buyer_email, pack_token, packs_notified_at")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .maybeSingle<{
      id: string;
      seller_id: string;
      code: string;
      status: string;
      buyer_name: string;
      buyer_email: string;
      pack_token: string | null;
      packs_notified_at: string | null;
    }>();
  if (!order || !order.pack_token) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (order.status !== "confirmado") return NextResponse.json({ error: "Confirme o pedido antes de avisar o comprador." }, { status: 409 });

  if (order.packs_notified_at) {
    const recente = Date.now() - Date.parse(order.packs_notified_at) < REENVIO_MS;
    if (body.force !== true) return NextResponse.json({ sent: false, already: true });
    if (recente) return NextResponse.json({ error: "O e-mail acabou de ser enviado. Espere alguns minutos para reenviar." }, { status: 429 });
  }
  if (!emailConfigured()) return NextResponse.json({ error: "Envio de e-mail não configurado." }, { status: 503 });

  const admin = createAdminClient();
  const [{ data: packs }, { data: shop }] = await Promise.all([
    admin.from("packs").select("number").eq("order_id", order.id).order("number"),
    admin.from("shops").select("seller_name").eq("user_id", order.seller_id).maybeSingle<{ seller_name: string | null }>(),
  ]);
  const notice = {
    buyerName: order.buyer_name,
    code: order.code,
    token: order.pack_token,
    numbers: (packs ?? []).map((p) => p.number as number),
    shopName: shop?.seller_name || DEFAULT_SHOP_NAME,
  };
  if (!notice.numbers.length) return NextResponse.json({ error: "Pedido sem pacotes." }, { status: 409 });

  try {
    await sendEmail({ to: order.buyer_email, subject: packsReadySubject(notice), html: packsReadyHtml(notice), text: packsReadyText(notice) });
  } catch (e) {
    console.error("[pacotes/aviso] falha no envio", order.id, e);
    return NextResponse.json({ error: "Não foi possível enviar o e-mail — tente de novo." }, { status: 502 });
  }
  await admin.from("orders").update({ packs_notified_at: new Date().toISOString() }).eq("id", order.id);
  return NextResponse.json({ sent: true });
}
