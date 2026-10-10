import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// Link de e-mail no formato token_hash (ex: recuperação de senha). Diferente de /auth/callback (que troca
// um código e só funciona no navegador que fez o pedido), este abre em qualquer aparelho. Para usar,
// o modelo do e-mail no Supabase precisa apontar para cá:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/login/nova-senha
const TIPOS: EmailOtpType[] = ["recovery", "signup", "email", "magiclink", "invite", "email_change"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (tokenHash && type && TIPOS.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?authError=1`);
}
