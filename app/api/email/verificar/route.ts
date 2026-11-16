import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { conferirCodigo } from "@/lib/verificacaoEmail";

// Confere o código digitado. Certo: o e-mail fica confirmado e a assinatura da loja libera o teste grátis.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, erro: "Entre na sua conta de novo." }, { status: 401 });
  const { codigo } = (await request.json().catch(() => ({}))) as { codigo?: unknown };
  try {
    const r = await conferirCodigo(user, typeof codigo === "string" ? codigo : "");
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch (e) {
    console.error("[email/verificar]", user.id, e);
    return NextResponse.json({ ok: false, erro: "Não foi possível conferir o código — tente de novo." }, { status: 500 });
  }
}
