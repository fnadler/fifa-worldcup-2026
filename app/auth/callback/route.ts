import { NextResponse } from "next/server";
import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

// Link do e-mail de confirmação de cadastro. Depois de validar, segue para ?next= (ex: /assinar)
// ou para a coleção.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?authError=1`);
}
