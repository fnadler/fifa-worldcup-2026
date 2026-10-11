import { NextResponse } from "next/server";
import { CATALOGS, getCatalog } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

// Remove uma coleção da conta: apaga todas as marcações dela (coladas e repetidas), o link público e
// a linha em user_albums. Sem as repetidas, a loja fica sem itens dessa coleção. Não tem volta.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { albumId?: unknown };
  const albumId = typeof body.albumId === "string" && CATALOGS.some((c) => c.id === body.albumId) ? body.albumId : null;
  if (!albumId) return NextResponse.json({ error: "Coleção inválida." }, { status: 400 });

  // Pedidos novos ainda dentro do prazo seguram repetidas desta coleção: sem elas, o lojista não
  // conseguiria confirmar. Precisa resolver os pedidos antes.
  const { count: abertos } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", user.id)
    .eq("album_id", albumId)
    .eq("status", "novo")
    .gt("reserved_until", new Date().toISOString());
  if (abertos) {
    return NextResponse.json(
      {
        error: `Sua loja tem ${abertos} pedido${abertos > 1 ? "s" : ""} novo${abertos > 1 ? "s" : ""} com itens desta coleção. Confirme ou cancele ${abertos > 1 ? "os pedidos" : "o pedido"} antes de remover.`,
      },
      { status: 409 }
    );
  }

  // As marcações ficam numa tabela só (collection), por código — apaga em lotes os códigos da coleção.
  const codes = getCatalog(albumId).blocks.flatMap((b) => b.codes);
  for (let i = 0; i < codes.length; i += 200) {
    const { error } = await supabase.from("collection").delete().eq("user_id", user.id).in("code", codes.slice(i, i + 200));
    if (error) {
      console.error("[colecoes/remover] collection", user.id, albumId, error);
      return NextResponse.json({ error: "Não foi possível remover a coleção — tente de novo." }, { status: 500 });
    }
  }

  await supabase.from("collection_shares").delete().eq("user_id", user.id).eq("album_id", albumId);
  const { error } = await supabase.from("user_albums").delete().eq("user_id", user.id).eq("album_id", albumId);
  if (error) {
    console.error("[colecoes/remover] user_albums", user.id, albumId, error);
    return NextResponse.json({ error: "Não foi possível remover a coleção — tente de novo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
