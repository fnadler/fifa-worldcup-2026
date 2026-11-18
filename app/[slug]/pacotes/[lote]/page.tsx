import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LotLanding from "@/components/packs/LotLanding";
import { PLATFORM_NAME, slugProblem } from "@/lib/brand";
import { loadPublicLot, publicLotMeta } from "@/lib/packsPublic";
import "../lot.css";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; lote: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, lote } = await params;
  if (slugProblem(slug)) return {};
  const meta = await publicLotMeta(slug, lote);
  if (!meta) return {};
  const title = `Pacote Legends · ${meta.title} — ${meta.shopName}`;
  const description =
    meta.description.split("\n")[0] || "Cada pacote traz 1 Legend garantida e mais 7 figurinhas da Copa 2026. Escolha o seu número.";
  return {
    title: `${title} | ${PLATFORM_NAME}`,
    description,
    openGraph: { title, description, ...(meta.image_url ? { images: [meta.image_url] } : {}) },
  };
}

// Página promocional de um lote de pacotes: pote de Legends, grade dos pacotes e pedido.
export default async function PackLotPublicPage({ params }: Params) {
  const { slug, lote } = await params;
  if (slugProblem(slug)) notFound();
  const data = await loadPublicLot(slug, lote);
  if (!data) notFound();
  return <LotLanding data={data} />;
}
