import { NextResponse } from "next/server";
import { cleanAttribution } from "@/lib/attribution";
import { lerIntencao } from "@/lib/intencao";
import { parseAccountInput } from "@/lib/profile";
import { TOO_MANY, withinRateLimit } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

// Cria a conta já confirmada, para o cadastro não depender do link de confirmação (nem da opção "Confirm
// email" do Supabase): o e-mail só é conferido ao ativar o teste da loja, por código (lib/verificacaoEmail.ts).
// O LoginForm chama aqui e, em seguida, entra com e-mail e senha no navegador.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  if (!EMAIL.test(email) || email.length > 254) return NextResponse.json({ erro: "Confira o e-mail digitado." }, { status: 400 });
  if (senha.length < 6) return NextResponse.json({ erro: "Senha fraca — use pelo menos 6 caracteres." }, { status: 400 });
  const perfil = parseAccountInput(String(corpo.nome ?? ""), String(corpo.whatsapp ?? ""));
  if ("error" in perfil) return NextResponse.json({ erro: perfil.error }, { status: 400 });

  const admin = createAdminClient();
  if (!(await withinRateLimit(admin, request, [{ name: "cadastro", windowSeconds: 3600, max: 10 }]))) {
    return NextResponse.json({ erro: TOO_MANY }, { status: 429 });
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: {
      ...perfil.data,
      onboarding: "pending",
      intencao: lerIntencao(corpo.intencao) ?? "colecionar",
      verificacao: "pendente",
      attr: cleanAttribution(corpo.attr),
    },
  });
  if (error) {
    if (error.code === "email_exists" || /already (been )?registered/i.test(error.message)) {
      return NextResponse.json({ erro: "Já existe uma conta com esse e-mail. Entre com a sua senha ou use “Esqueci minha senha”.", existe: true }, { status: 409 });
    }
    if (error.code === "weak_password") return NextResponse.json({ erro: "Senha fraca — use pelo menos 6 caracteres." }, { status: 400 });
    console.error("[cadastro/criar]", error.code, error.message);
    return NextResponse.json({ erro: "Não foi possível criar a conta — confira os dados e tente de novo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
