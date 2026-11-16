import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarCodigo } from "@/lib/verificacaoEmail";

// Manda o código de 6 dígitos que confirma o e-mail (tela de assinatura da loja).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, erro: "Entre na sua conta de novo." }, { status: 401 });
  try {
    const r = await enviarCodigo(user, request);
    return NextResponse.json(r, { status: r.ok ? 200 : 429 });
  } catch (e) {
    console.error("[email/codigo]", user.id, e);
    return NextResponse.json({ ok: false, erro: "Não foi possível enviar o código — tente de novo em instantes." }, { status: 500 });
  }
}
