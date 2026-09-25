import { NextResponse } from "next/server";
import { profileFromMetadata } from "@/lib/profile";
import { getStripe, stripeConfigured, TRIAL_DAYS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ATIVAS = new Set(["active", "trialing", "past_due"]);

// Cria a sessão de pagamento do Stripe (assinatura mensal com cartão) para o usuário logado.
export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Assinaturas ainda não estão disponíveis." }, { status: 503 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para assinar." }, { status: 401 });

  const admin = createAdminClient();
  const stripe = getStripe();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null; stripe_subscription_id: string | null; status: string | null }>();

  if (sub?.status && ATIVAS.has(sub.status)) {
    return NextResponse.json({ error: "Você já tem uma assinatura ativa — gerencie pelo seu perfil." }, { status: 409 });
  }

  // Um cliente do Stripe por conta, criado na primeira tentativa de assinar.
  let customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: profileFromMetadata(user.user_metadata).full_name || undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    const { error } = await admin
      .from("subscriptions")
      .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "Não foi possível iniciar a assinatura." }, { status: 500 });
  }

  // Teste grátis só para quem nunca assinou.
  const temTeste = !sub?.stripe_subscription_id;
  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    payment_method_types: ["card"],
    subscription_data: {
      metadata: { user_id: user.id },
      ...(temTeste ? { trial_period_days: TRIAL_DAYS } : {}),
    },
    locale: "pt-BR",
    allow_promotion_codes: true,
    success_url: `${origin}/assinar/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/assinar`,
  });

  return NextResponse.json({ url: session.url });
}
