import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import AuctionResults from "@/components/admin/AuctionResults";
import { formatAuctionDate } from "@/lib/auctions";
import { adminUser, loadAuction, loadSettlements } from "@/lib/auctionsServer";
import { PLATFORM_NAME } from "@/lib/brand";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Resultado do leilão — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

// Resultado do leilão: quem arrematou o quê, cobrança por arrematante, pagamento, envio e rastreio.
export default async function AuctionResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/leiloes/${id}/resultado`);
  if (!(await adminUser())) notFound();

  const [data, shop] = await Promise.all([loadAuction(id), ownShop(supabase, user.id)]);
  if (!data) notFound();
  const { settlements, bidders } = await loadSettlements(id);
  const bidderMap = Object.fromEntries(bidders.map((b) => [b.id, { name: b.name, whatsapp: b.whatsapp }]));

  return (
    <div className="app-shell">
      <AccountHeader title="Resultado do leilão" email={user.email ?? null} shop={shop} />
      <div className="admin-page">
        <nav className="adm-crumbs">
          <Link href={`/admin/leiloes/${id}`}>← {data.auction.title}</Link>
          <Link href={`/admin/leiloes/${id}/ao-vivo`}>Painel ao vivo</Link>
        </nav>
        <p className="adm-updated">{formatAuctionDate(data.auction.startsAt)}</p>
        <AuctionResults auction={data.auction} lots={data.lots} bidders={bidderMap} settlements={settlements} />
      </div>
    </div>
  );
}
