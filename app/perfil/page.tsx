import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileFromMetadata } from "@/lib/profile";
import { ownShop } from "@/lib/shopLink";
import { ensureDefaultCollection, userCollections } from "@/lib/userCollections";
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
  const [shop, primeiras] = await Promise.all([ownShop(supabase, user.id), userCollections(supabase, user.id)]);
  let collections = primeiras;
  if (!collections.length) {
    await ensureDefaultCollection(supabase, user.id, profile.collection_name);
    collections = await userCollections(supabase, user.id);
  }

  return (
    <ProfilePage
      email={user.email ?? null}
      createdAt={user.created_at}
      profile={profile}
      userId={user.id}
      collections={collections}
      shop={shop}
    />
  );
}
