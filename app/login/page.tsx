import { redirect } from "next/navigation";
import { activeAlbums } from "@/lib/albums";
import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; next?: string; authError?: string }>;
}) {
  const { modo, next, authError } = await searchParams;
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
      initialError={authError ? "Esse link não vale mais (já foi usado ou venceu). Peça um novo em “Esqueci minha senha”." : null}
    />
  );
}
