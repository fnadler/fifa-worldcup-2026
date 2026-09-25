import { NextResponse } from "next/server";
import { forgetStaleSubscription, isStripeMissing } from "@/lib/billing";
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

  try {
    const admin = createAdminClient();
    const stripe = getStripe();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle<{ stripe_customer_id: string | null; stripe_subscription_id: string | null }>();

    let customerId = sub?.stripe_customer_id ?? null;
    let jaAssinou = Boolean(sub?.stripe_subscription_id);

    // O Stripe é a fonte da verdade: confere a assinatura salva no modo atual (teste/produção).
    if (sub?.stripe_subscription_id) {
      try {
        const atual = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        if (ATIVAS.has(atual.status)) {
          return NextResponse.json(
            { error: "Você já tem uma assinatura ativa — gerencie pelo seu perfil." },
            { status: 409 }
          );
        }
      } catch (err) {
        if (!isStripeMissing(err)) throw err;
        await forgetStaleSubscription(user.id);
        customerId = null;
        jaAssinou = false;
      }
    }
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if ((c as { deleted?: boolean }).deleted) customerId = null;
      } catch (err) {
        if (!isStripeMissing(err)) throw err;
        customerId = null;
      }
    }

    // Um cliente do Stripe por conta, criado na primeira tentativa de assinar.
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
      if (error) throw error;
    }

    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      payment_method_types: ["card"],
      subscription_data: {
        metadata: { user_id: user.id },
        // teste grátis só para quem nunca assinou
        ...(jaAssinou ? {} : { trial_period_days: TRIAL_DAYS }),
      },
      locale: "pt-BR",
      allow_promotion_codes: true,
      success_url: `${origin}/assinar/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/assinar`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[assinatura/checkout]", user.id, err);
    return NextResponse.json({ error: "Não foi possível iniciar a assinatura — tente de novo." }, { status: 500 });
  }
}
