import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PLATFORM_NAME } from "@/lib/brand";
import { formatBRL } from "@/lib/shop";
import { hasShopAccess } from "@/lib/shopAccess";
import { getStripe, stripeConfigured, TRIAL_DAYS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import SubscribePage from "@/components/SubscribePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Assine a loja — ${PLATFORM_NAME}`,
};

export default async function AssinarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (await hasShopAccess(supabase, user.id)) redirect("/vendas");

  if (!stripeConfigured()) return <SubscribePage email={user.email ?? null} plan={null} />;

  const [price, { data: sub }] = await Promise.all([
    getStripe().prices.retrieve(process.env.STRIPE_PRICE_ID!),
    createAdminClient()
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle<{ stripe_subscription_id: string | null }>(),
  ]);

  return (
    <SubscribePage
      email={user.email ?? null}
      plan={{
        price: price.unit_amount != null ? formatBRL(price.unit_amount) : "",
        trialDays: sub?.stripe_subscription_id ? 0 : TRIAL_DAYS,
        returning: Boolean(sub?.stripe_subscription_id),
      }}
    />
  );
}
