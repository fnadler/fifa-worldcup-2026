import type { Metadata } from "next";
import { renderShop, shopMetadata } from "@/lib/shopPage";

export const dynamic = "force-dynamic";

// Link permanente da loja (por token). Redireciona para /<slug> quando a loja já tem nome.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  return shopMetadata({ token: (await params).token });
}

export default async function LojaPorTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ colecao?: string }>;
}) {
  return renderShop({ token: (await params).token }, (await searchParams).colecao);
}
