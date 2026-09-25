import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncSubscription } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Webhook do Stripe. Cada evento relevante relê a assinatura no Stripe e a sincroniza
// (sync é idempotente e baseado em estado, então eventos repetidos ou fora de ordem não
// causam problema). Erro → 500, e o Stripe tenta de novo.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await syncSubscription(await stripe.subscriptions.retrieve(id), session.client_reference_id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(await stripe.subscriptions.retrieve(event.data.object.id));
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook]", event.type, event.id, err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  await createAdminClient()
    .from("stripe_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true });
  return NextResponse.json({ received: true });
}
