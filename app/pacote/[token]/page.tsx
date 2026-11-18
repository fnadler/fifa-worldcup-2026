import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PackHub from "@/components/packs/PackHub";
import { PLATFORM_NAME } from "@/lib/brand";
import { loadBuyerPacks } from "@/lib/packsBuyer";
import "../../[slug]/pacotes/lot.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Seus pacotes — ${PLATFORM_NAME}`,
  robots: { index: false, follow: false },
};

// Pacotes de um pedido, pelo link secreto: aguardando pagamento, prontos para abrir ou já abertos.
export default async function BuyerPacksPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadBuyerPacks(token);
  if (!data) notFound();
  return <PackHub data={data} />;
}
