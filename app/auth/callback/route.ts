import { after, NextResponse } from "next/server";
import { sendCommunityInviteOnce } from "@/lib/communityInvite";
import { safeNext } from "@/lib/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Link do e-mail de confirmação de cadastro. Depois de validar, segue para ?next= (ex: /assinar)
// ou para a coleção.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Conta confirmada: manda o convite da comunidade (uma vez por conta), sem atrasar o redirecionamento.
      const user = data.user;
      if (user) after(() => sendCommunityInviteOnce(createAdminClient(), user).then(() => undefined));
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?authError=1`);
}
