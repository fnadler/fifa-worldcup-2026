import { createClient } from "@/lib/supabase/server";
import AlbumApp from "@/components/AlbumApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AlbumApp
      initialUser={user ? { id: user.id, email: user.email ?? null } : null}
    />
  );
}
