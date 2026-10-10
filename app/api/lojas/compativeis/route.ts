import { NextResponse } from "next/server";
import { parseAlbumId } from "@/lib/shopAlbums";
import { matchShops } from "@/lib/shopMatch";
import { createClient } from "@/lib/supabase/server";

// Lojas com o que falta numa coleção de quem está logado (?album=<albums.id>), com o detalhe por categoria.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const albumId = parseAlbumId(new URL(request.url).searchParams.get("album"));
  if (!albumId) return NextResponse.json({ error: "album" }, { status: 400 });

  return NextResponse.json(await matchShops(user.id, albumId));
}
