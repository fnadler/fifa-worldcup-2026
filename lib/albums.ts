import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AlbumOption {
  id: string;
  name: string;
}

export const DEFAULT_ALBUM_ID = "wc2026-panini";

// Coleções que a plataforma oferece (tabela albums, leitura pública das ativas).
// Com mais de uma, a criação de conta mostra a lista para o usuário escolher.
export async function activeAlbums(client: SupabaseClient): Promise<AlbumOption[]> {
  const { data } = await client.from("albums").select("id, name").eq("active", true).order("position");
  return (data as AlbumOption[] | null) ?? [];
}
