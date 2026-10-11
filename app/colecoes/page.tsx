import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { albumCover } from "@/lib/albumCovers";
import { activeAlbums } from "@/lib/albums";
import { CATALOGS } from "@/lib/catalog";
import { fetchAll } from "@/lib/fetchAll";
import { loadShopAlbums } from "@/lib/shopAlbums";
import { ownShop } from "@/lib/shopLink";
import { userCollections } from "@/lib/userCollections";
import { PLATFORM_NAME } from "@/lib/brand";
import CollectionsPage from "@/components/CollectionsPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Coleções — ${PLATFORM_NAME}`,
};

export default async function ColecoesPage({ searchParams }: { searchParams: Promise<{ adicionar?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/colecoes");

  const [albums, mine, shop, { data: rows }, shopAlbums] = await Promise.all([
    activeAlbums(supabase),
    userCollections(supabase, user.id),
    ownShop(supabase, user.id),
    // marcações da pessoa: o aviso de "Remover coleção" diz quantos itens serão apagados
    fetchAll<{ code: string }>((from, to) =>
      supabase.from("collection").select("code").eq("user_id", user.id).gt("qty", 0).order("code").range(from, to)
    ),
    loadShopAlbums(supabase, user.id),
  ]);
  const marcados = new Set((rows ?? []).map((r) => r.code));
  const naLoja = new Set(shopAlbums.filter((a) => a.enabled).map((a) => a.albumId));
  const ativos = new Set(albums.map((a) => a.id));
  const minhas = new Set(mine.map((c) => c.albumId));

  return (
    <CollectionsPage
      userId={user.id}
      email={user.email ?? null}
      shop={shop}
      highlight={(await searchParams).adicionar ?? null}
      nextPosition={mine.length}
      options={CATALOGS.filter((c) => ativos.has(c.id) || minhas.has(c.id)).map((c) => ({
        albumId: c.id,
        slug: c.slug,
        name: c.name,
        total: c.total,
        itemSingular: c.itemSingular,
        itemPlural: c.itemPlural,
        cover: albumCover(c.slug),
        marked: c.blocks.reduce((n, b) => n + b.codes.filter((code) => marcados.has(code)).length, 0),
        inShop: shop.active && naLoja.has(c.id),
        owned: mine.find((m) => m.albumId === c.id)?.collectionName ?? (minhas.has(c.id) ? "" : null),
      }))}
    />
  );
}
