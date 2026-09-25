import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "./supabase/admin";
import { GRACE_DAYS } from "./stripe";

const toIso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

// Espelha a assinatura do Stripe no banco (subscriptions + shop_entitlements) via
// sync_subscription, que decide até quando a loja fica liberada. Sempre chamar com a
// assinatura recém-lida do Stripe (não com o payload do evento), para não aplicar estado velho.
export async function syncSubscription(sub: Stripe.Subscription, userIdHint?: string | null): Promise<void> {
  const admin = createAdminClient();
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let userId = sub.metadata?.user_id || userIdHint || null;
  if (!userId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customer)
      .maybeSingle<{ user_id: string }>();
    userId = data?.user_id ?? null;
  }
  if (!userId) throw new Error(`Assinatura ${sub.id} sem usuário associado (cliente ${customer})`);

  // Na API atual do Stripe o período fica no item da assinatura.
  const item = sub.items.data[0];
  const { error } = await admin.rpc("sync_subscription", {
    p_user: userId,
    p_customer: customer,
    p_subscription: sub.id,
    p_status: sub.status,
    p_price: item?.price?.id ?? null,
    p_period_start: toIso(item?.current_period_start),
    p_period_end: toIso(item?.current_period_end),
    p_trial_end: toIso(sub.trial_end),
    // cancelamento agendado pode vir como cancel_at_period_end ou como cancel_at (portal)
    p_cancel_at_period_end: sub.cancel_at_period_end || sub.cancel_at !== null,
    p_grace_days: GRACE_DAYS,
  });
  if (error) throw error;
}

export interface SubscriptionRow {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  access_until: string | null;
}

export const SUBSCRIPTION_COLUMNS =
  "stripe_customer_id, stripe_subscription_id, status, current_period_end, trial_end, cancel_at_period_end, access_until";
