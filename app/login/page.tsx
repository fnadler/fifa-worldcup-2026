import { redirect } from "next/navigation";
import { activeAlbums } from "@/lib/albums";
import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; next?: string }>;
}) {
  const { modo, next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect(safeNext(next));

  return (
    <LoginForm
      albums={await activeAlbums(supabase)}
      initialMode={modo === "cadastro" ? "signup" : "signin"}
      next={safeNext(next)}
    />
  );
}
