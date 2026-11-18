import { NextResponse } from "next/server";
import { TOKEN, isBuyer } from "@/lib/packsBuyer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// "Marcar na minha coleção": soma as 8 figurinhas de cada pacote aberto (uma vez por pacote) na coleção
// da conta do pedido — a registrada no pedido ou a do mesmo e-mail.

export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para guardar as figurinhas." }, { status: 401 });

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("status, buyer_email, buyer_user_id")
    .eq("pack_token", token)
    .maybeSingle<{ status: string; buyer_email: string; buyer_user_id: string | null }>();
  if (!order || order.status !== "confirmado") return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (!isBuyer(user, order))
    return NextResponse.json({ error: "Entre com a conta do e-mail usado no pedido para guardar as figurinhas." }, { status: 403 });

  const { data, error } = await admin.rpc("pack_add_to_collection", { p_token: token, p_user: user.id });
  if (error) return NextResponse.json({ error: "Não foi possível guardar as figurinhas — tente de novo." }, { status: 500 });
  return NextResponse.json({ added: (data as number) ?? 0 });
}
