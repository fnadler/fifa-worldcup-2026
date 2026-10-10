import { redirect } from "next/navigation";
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
      initialMode={modo === "cadastro" ? "signup" : "signin"}
      next={safeNext(next)}
      initialError={
        authError
          ? "Não foi possível abrir esse link aqui: ele já foi usado, venceu ou foi aberto em outro navegador. Se você acabou de confirmar o cadastro, é só entrar com seu e-mail e senha. Para trocar a senha, peça um novo link em “Esqueci minha senha”."
          : null
      }
    />
  );
}
