import { after, NextResponse } from "next/server";
import { sendCommunityInviteOnce } from "@/lib/communityInvite";
import { saveSignupAttribution } from "@/lib/metaConversions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Conta criada já com sessão (sem confirmação de e-mail no cadastro): grava a atribuição do cadastro, manda o
// lead ao ads-platform e o convite da comunidade — o que antes só acontecia ao abrir o link de confirmação.
// O LoginForm chama logo depois do signUp. Os dois passos são de uma vez só por conta, então repetir não duplica.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sem sessão" }, { status: 401 });

  after(() => saveSignupAttribution(user, request));
  after(() => sendCommunityInviteOnce(createAdminClient(), user).then(() => undefined));
  return NextResponse.json({ ok: true });
}
