import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { slugProblem } from "@/lib/brand";
import { renderShop, shopMetadata } from "@/lib/shopPage";

export const dynamic = "force-dynamic";

// Endereço amigável da loja: /<slug>. Rotas do app (/login, /perfil…) têm prioridade por
// serem estáticas, e esses nomes são reservados (lib/brand.ts + constraint no banco).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return slugProblem(slug) ? {} : shopMetadata({ slug });
}

export default async function LojaPorSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slugProblem(slug)) notFound();
  return renderShop({ slug });
}
