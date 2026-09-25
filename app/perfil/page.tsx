import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileFromMetadata } from "@/lib/profile";
import { ownShopHref } from "@/lib/shopLink";
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

  return (
    <ProfilePage
      email={user.email ?? null}
      createdAt={user.created_at}
      profile={profileFromMetadata(user.user_metadata)}
      shopHref={await ownShopHref(supabase, user.id)}
    />
  );
}
