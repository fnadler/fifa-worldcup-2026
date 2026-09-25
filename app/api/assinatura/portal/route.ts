import { NextResponse } from "next/server";
import { forgetStaleSubscription, isStripeMissing } from "@/lib/billing";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Portal do assinante no Stripe: trocar cartão, cancelar, ver faturas.
export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: "Assinaturas indisponíveis." }, { status: 503 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  const { data: sub } = await createAdminClient()
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();
  if (!sub?.stripe_customer_id) return NextResponse.json({ error: "Você ainda não tem assinatura." }, { status: 404 });

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${new URL(request.url).origin}/perfil`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (isStripeMissing(err)) {
      // cliente salvo não existe no modo atual do Stripe (ex: assinatura feita em ambiente de teste)
      await forgetStaleSubscription(user.id);
      return NextResponse.json(
        {
          error: "Não encontramos sua assinatura no sistema de pagamentos. Se quiser usar a loja, assine novamente.",
          stale: true,
        },
        { status: 409 }
      );
    }
    console.error("[assinatura/portal]", user.id, err);
    return NextResponse.json({ error: "Não foi possível abrir o portal — tente de novo." }, { status: 500 });
  }
}
