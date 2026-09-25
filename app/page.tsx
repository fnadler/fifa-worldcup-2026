import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ownShopHref } from "@/lib/shopLink";
import AlbumApp from "@/components/AlbumApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const shopHref = await ownShopHref(supabase, user.id);

  return <AlbumApp initialUser={{ id: user.id, email: user.email ?? null }} shopHref={shopHref} />;
}
