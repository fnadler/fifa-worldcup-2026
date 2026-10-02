import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_COLLECTION_NAME } from "./brand";
import { CATALOGS, DEFAULT_CATALOG, getCatalog } from "./catalog";

// Coleções que a pessoa acompanha (tabela user_albums), com o nome que ela deu a cada uma.

export interface UserCollection {
  albumId: string;
  slug: string;
  albumName: string;
  /** Nome que a pessoa deu à coleção (vazio = usa o padrão). */
  collectionName: string;
}

/** Cookie com o endereço da última coleção aberta — /colecao volta para ela. */
export const LAST_COLLECTION_COOKIE = "gn_colecao";

const KNOWN = new Set(CATALOGS.map((c) => c.id));

export async function userCollections(supabase: SupabaseClient, userId: string): Promise<UserCollection[]> {
  const { data } = await supabase
    .from("user_albums")
    .select("album_id, collection_name")
    .eq("user_id", userId)
    .order("position")
    .order("created_at");
  return (data ?? [])
    .filter((r) => KNOWN.has(r.album_id as string))
    .map((r) => {
      const c = getCatalog(r.album_id as string);
      return { albumId: c.id, slug: c.slug, albumName: c.name, collectionName: (r.collection_name as string | null) ?? "" };
    });
}

/** Garante que a pessoa tem ao menos o Álbum Copa (contas antigas sem linha em user_albums). */
export async function ensureDefaultCollection(supabase: SupabaseClient, userId: string, collectionName: string) {
  await supabase
    .from("user_albums")
    .upsert(
      { user_id: userId, album_id: DEFAULT_CATALOG.id, collection_name: collectionName || null },
      { onConflict: "user_id,album_id", ignoreDuplicates: true }
    );
}

export function collectionTitleOf(c: Pick<UserCollection, "collectionName"> | undefined): string {
  return c?.collectionName || DEFAULT_COLLECTION_NAME;
}
