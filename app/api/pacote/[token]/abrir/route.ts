import { NextResponse } from "next/server";
import { TOKEN } from "@/lib/packsBuyer";
import { TOO_MANY, withinRateLimit, type RateRule } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

// Abre um pacote do pedido (link secreto): o banco sorteia a Legend do pote e devolve o conteúdo.
// Abrir de novo devolve o mesmo resultado.

const LIMITE: RateRule[] = [{ name: "abrir-pacote", windowSeconds: 600, max: 120 }];

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) return NextResponse.json({ error: "Pacote não encontrado." }, { status: 404 });

  let number: unknown;
  try {
    ({ number } = (await request.json()) as { number?: unknown });
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (!Number.isInteger(number) || (number as number) < 1 || (number as number) > 999) {
    return NextResponse.json({ error: "Pacote não encontrado." }, { status: 404 });
  }

  const admin = createAdminClient();
  if (!(await withinRateLimit(admin, request, LIMITE))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const { data, error } = await admin
    .rpc("open_pack", { p_token: token, p_number: number })
    .single<{ legend_code: string; commons: string[]; opened_at: string }>();
  if (error?.message.includes("PAGAMENTO_PENDENTE"))
    return NextResponse.json({ error: "O pagamento deste pedido ainda não foi confirmado pela loja." }, { status: 409 });
  if (error?.message.includes("POTE_VAZIO"))
    return NextResponse.json({ error: "Não foi possível abrir agora. Fale com a loja pelo WhatsApp." }, { status: 409 });
  if (error || !data) return NextResponse.json({ error: "Não foi possível abrir o pacote — tente de novo." }, { status: 500 });

  return NextResponse.json({ legend: data.legend_code, commons: data.commons ?? [], openedAt: data.opened_at });
}
