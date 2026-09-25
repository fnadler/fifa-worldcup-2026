import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasShopAccess } from "@/lib/shopAccess";
import AlbumApp from "@/components/AlbumApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const canSell = await hasShopAccess(supabase, user.id);

  return <AlbumApp initialUser={{ id: user.id, email: user.email ?? null }} canSell={canSell} />;
}
