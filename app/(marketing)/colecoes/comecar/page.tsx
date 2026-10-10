import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OnboardingCollections from "@/components/marketing/OnboardingCollections";
import { albumCover } from "@/lib/albumCovers";
import { activeAlbums } from "@/lib/albums";
import { PLATFORM_NAME } from "@/lib/brand";
import { CATALOGS } from "@/lib/catalog";
import { ONBOARDING_PATH } from "@/lib/onboarding";
import { profileFromMetadata } from "@/lib/profile";
import { stickerImage } from "@/lib/stickerImages";
import { createClient } from "@/lib/supabase/server";
import { userCollections } from "@/lib/userCollections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Escolha sua coleção — ${PLATFORM_NAME}` };

// Primeira tela depois de confirmar o cadastro: escolher o que colecionar, pela capa do álbum.
export default async function ComecarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(ONBOARDING_PATH)}`);

  const [albums, mine] = await Promise.all([activeAlbums(supabase), userCollections(supabase, user.id)]);
  const ativos = new Set(albums.map((a) => a.id));
  const profile = profileFromMetadata(user.user_metadata);

  return (
    <OnboardingCollections
      userId={user.id}
      firstName={profile.full_name.split(" ")[0] ?? ""}
      owned={mine.map((c) => c.albumId)}
      options={CATALOGS.filter((c) => ativos.has(c.id)).map((c) => ({
        albumId: c.id,
        slug: c.slug,
        name: c.name,
        total: c.total,
        itemPlural: c.itemPlural,
        cover: albumCover(c.slug),
        // sem capa: a primeira figurinha com foto do último bloco de seleção (um craque) faz as vezes
        fallback: stickerImage(c.blocks.find((b) => b.tipo === "TEAM")?.codes[1] ?? c.blocks[0].codes[0], "large"),
      }))}
    />
  );
}
