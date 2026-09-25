import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ALBUM_ID, activeAlbums } from "@/lib/albums";
import { profileFromMetadata } from "@/lib/profile";
import { SUBSCRIPTION_COLUMNS, type SubscriptionRow } from "@/lib/billing";
import { ownShop } from "@/lib/shopLink";
import ProfilePage from "@/components/ProfilePage";
import { PLATFORM_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Minha conta — ${PLATFORM_NAME}`,
};

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = profileFromMetadata(user.user_metadata);
  const [shop, { data: subscription }, { data: entitlement }, albums] = await Promise.all([
    ownShop(supabase, user.id),
    supabase.from("subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", user.id).maybeSingle<SubscriptionRow>(),
    supabase.from("shop_entitlements").select("source").eq("user_id", user.id).maybeSingle<{ source: string }>(),
    activeAlbums(supabase),
  ]);
  const albumName = albums.find((a) => a.id === (profile.album_id ?? DEFAULT_ALBUM_ID))?.name ?? null;

  return (
    <ProfilePage
      email={user.email ?? null}
      createdAt={user.created_at}
      profile={profile}
      albumName={albumName}
      shop={shop}
      subscription={subscription}
      manualAccess={entitlement?.source === "manual"}
    />
  );
}
