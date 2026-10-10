import type { EmailOtpType } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";
import { sendCommunityInviteOnce } from "@/lib/communityInvite";
import { COLLECTION_PATH, SIGNUP_CONFIRMED_PATH, safeNext } from "@/lib/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Link de e-mail no formato token_hash. Diferente de /auth/callback (que troca um código e só funciona
// no navegador que fez o pedido), este abre em qualquer aparelho. Os modelos de e-mail no Supabase
// apontam para cá (emails/, gerados por scripts/build-auth-emails.mjs):
//   recuperação: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/login/nova-senha
//   cadastro:    {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&destino={{ .RedirectTo }}
const TIPOS: EmailOtpType[] = ["recovery", "signup", "email", "magiclink", "invite", "email_change"];

/** ?next= guardado no endereço que o cadastro pediu (…/auth/callback?next=/assinar). */
function nextDoDestino(destino: string | null): string {
  try {
    return safeNext(destino ? new URL(destino).searchParams.get("next") : null);
  } catch {
    return COLLECTION_PATH;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && TIPOS.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (type !== "signup") return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);

      // Cadastro confirmado: convite da comunidade (uma vez por conta) e tela de confirmação, que leva
      // adiante para o destino pedido no cadastro.
      const user = data.user;
      if (user) after(() => sendCommunityInviteOnce(createAdminClient(), user).then(() => undefined));
      const next = nextDoDestino(searchParams.get("destino"));
      const query = next === COLLECTION_PATH ? "" : `?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(`${origin}${SIGNUP_CONFIRMED_PATH}${query}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?authError=1`);
}
