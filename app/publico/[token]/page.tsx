import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectionTitle } from "@/lib/profile";
import { DEFAULT_CATALOG, getCatalog } from "@/lib/catalog";
import { DEFAULT_COLLECTION_NAME } from "@/lib/brand";
import PublicBoard from "@/components/PublicBoard";
import type { Qtd } from "@/lib/types";
import { fetchAll } from "@/lib/fetchAll";

export const dynamic = "force-dynamic";

export default async function PublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: share } = await admin
    .from("collection_shares")
    .select("user_id, album_id")
    .eq("token", token)
    .maybeSingle();

  if (!share) notFound();

  const catalog = getCatalog(share.album_id as string | null);
  const codes = new Set(catalog.blocks.flatMap((b) => b.codes));

  const [{ data: rows }, { data: ua }, { data: owner }] = await Promise.all([
    fetchAll<{ code: string; qty: number }>((from, to) =>
      admin.from("collection").select("code, qty").eq("user_id", share.user_id).gt("qty", 0).order("code").range(from, to)
    ),
    admin.from("user_albums").select("collection_name").eq("user_id", share.user_id).eq("album_id", catalog.id).maybeSingle(),
    admin.auth.admin.getUserById(share.user_id),
  ]);

  // Só os itens desta coleção (a tabela collection guarda todas as coleções da pessoa).
  const qtd: Qtd = {};
  (rows ?? []).forEach((row) => {
    if (row.qty > 0 && codes.has(row.code as string)) qtd[row.code as string] = row.qty as number;
  });

  // Links antigos do Álbum Copa sem linha em user_albums caem no nome do perfil.
  const nome =
    (ua?.collection_name as string | null) ||
    (catalog.id === DEFAULT_CATALOG.id ? collectionTitle(owner?.user?.user_metadata) : DEFAULT_COLLECTION_NAME);

  return <PublicBoard qtd={qtd} collectionName={nome} albumId={catalog.id} />;
}
