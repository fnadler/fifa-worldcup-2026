import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthShell from "@/components/marketing/AuthShell";
import { PLATFORM_NAME } from "@/lib/brand";
import { needsOnboarding } from "@/lib/onboarding";
import { profileFromMetadata } from "@/lib/profile";
import { COLLECTION_PATH, safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Cadastro confirmado — ${PLATFORM_NAME}` };

// Chega aqui quem abriu o link de confirmação do cadastro: o link já abriu a sessão.
export default async function ConfirmadoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?authError=1");

  const next = safeNext((await searchParams).next);
  const nome = profileFromMetadata(user.user_metadata).full_name.split(" ")[0];
  // /colecao leva a conta nova para a escolha das coleções (lib/onboarding.ts)
  const escolher = next === COLLECTION_PATH && needsOnboarding(user.user_metadata);

  return (
    <AuthShell
      title={nome ? `Tudo certo, ${nome}!` : "Tudo certo!"}
      subtitle="Seu e-mail foi confirmado e a sua conta está ativa."
      variant="signup"
    >
      <div className="login-form login-confirm">
        <div className="login-confirm-ok" aria-hidden="true">
          ✓
        </div>
        <p>
          {escolher
            ? "Agora é só escolher o que você vai colecionar. Dá para acompanhar mais de uma coleção e adicionar outras depois."
            : "Você já pode continuar de onde parou."}
        </p>
        <Link href={next} className="mk-btn mk-btn-yellow login-submit">
          {escolher ? "Escolher minhas coleções" : "Continuar"}
        </Link>
      </div>
    </AuthShell>
  );
}
