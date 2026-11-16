import { after, NextResponse } from "next/server";
import { lerTokenEntrada } from "@/lib/linkEntrada";
import { saveSignupAttribution } from "@/lib/metaConversions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { marcarVerificado } from "@/lib/verificacaoEmail";

// Link do e-mail de convite (quem começou o cadastro e não confirmou o e-mail). Confirma o e-mail — o clique
// prova que a pessoa recebe a mensagem —, abre a sessão, grava a atribuição do cadastro (manda o lead ao
// ads-platform com a data original e o anúncio de origem) e segue para a escolha das coleções.
// Uso único: depois de usado, ou vencido, leva ao login com o aviso de sempre.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const lido = lerTokenEntrada(searchParams.get("t"));
  const falha = NextResponse.redirect(`${origin}/login?authError=1`);
  if (!lido) return falha;

  const admin = createAdminClient();
  const { data: alvo } = await admin.auth.admin.getUserById(lido.userId);
  const user = alvo.user;
  if (!user?.email) return falha;
  if (user.app_metadata?.entrada_usada === lido.assinatura) return falha;

  if (!user.email_confirmed_at) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (error) {
      console.error("[auth/entrar] confirmar", user.id, error.message);
      return falha;
    }
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (linkError || !link.properties?.hashed_token) {
    console.error("[auth/entrar] link", user.id, linkError?.message);
    return falha;
  }
  const supabase = await createClient();
  const { data: sessao, error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (error || !sessao.user) {
    console.error("[auth/entrar] sessão", user.id, error?.message);
    return falha;
  }

  // e-mail confirmado + o link marcado como usado, numa gravação só
  await marcarVerificado({ ...sessao.user, app_metadata: { ...sessao.user.app_metadata, entrada_usada: lido.assinatura } });
  after(() => saveSignupAttribution(sessao.user!, request));
  // Quem já escolheu as coleções (raro: confirmou por outro caminho) vai direto para a coleção.
  const destino = sessao.user.user_metadata?.onboarding === "pending" ? lido.destino : "/colecao";
  return NextResponse.redirect(`${origin}${destino}`);
}
