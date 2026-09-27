import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SUBSCRIPTION_COLUMNS, type SubscriptionRow } from "@/lib/billing";
import { PLATFORM_NAME } from "@/lib/brand";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";
import SubscriptionPage from "@/components/SubscriptionPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Assinatura — ${PLATFORM_NAME}`,
};

export default async function AssinaturaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/assinatura");

  const [shop, { data: subscription }, { data: entitlement }] = await Promise.all([
    ownShop(supabase, user.id),
    supabase.from("subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", user.id).maybeSingle<SubscriptionRow>(),
    supabase.from("shop_entitlements").select("source").eq("user_id", user.id).maybeSingle<{ source: string }>(),
  ]);

  return (
    <SubscriptionPage
      email={user.email ?? null}
      shop={shop}
      subscription={subscription}
      manualAccess={entitlement?.source === "manual"}
    />
  );
}
