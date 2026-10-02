import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { CATALOGS, DEFAULT_CATALOG } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

// Um link público (somente leitura) por coleção — o token é criado na primeira vez.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { albumId?: unknown };
  const albumId =
    typeof body.albumId === "string" && CATALOGS.some((c) => c.id === body.albumId) ? body.albumId : DEFAULT_CATALOG.id;

  const { data: existing } = await supabase
    .from("collection_shares")
    .select("token")
    .eq("user_id", user.id)
    .eq("album_id", albumId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ token: existing.token });
  }

  const token = randomUUID().replace(/-/g, "");
  const { error } = await supabase.from("collection_shares").insert({ token, user_id: user.id, album_id: albumId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token });
}
