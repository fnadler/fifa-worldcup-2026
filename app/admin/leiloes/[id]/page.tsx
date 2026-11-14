import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import AuctionForm from "@/components/admin/AuctionForm";
import AuctionLots from "@/components/admin/AuctionLots";
import { AUCTION_STATUS_LABEL, formatAuctionDate } from "@/lib/auctions";
import { adminUser, loadAuction } from "@/lib/auctionsServer";
import { PLATFORM_NAME } from "@/lib/brand";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Leilão — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

// Um leilão: dados e regras, e os lotes na ordem em que entram no grupo.
export default async function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/leiloes/${id}`);
  if (!(await adminUser())) notFound();

  const [data, shop] = await Promise.all([loadAuction(id), ownShop(supabase, user.id)]);
  if (!data) notFound();
  const { auction, lots } = data;

  return (
    <div className="app-shell">
      <AccountHeader title="Leilão" email={user.email ?? null} shop={shop} />
      <div className="admin-page">
        <nav className="adm-crumbs">
          <Link href="/admin/leiloes">← Leilões</Link>
        </nav>
        <section className="admin-section">
          <div className="collections-head">
            <h2 className="admin-section-title">{auction.title}</h2>
            <span className="adm-tag">{AUCTION_STATUS_LABEL[auction.status]}</span>
          </div>
          <p className="adm-updated">{formatAuctionDate(auction.startsAt)}</p>
          <AuctionForm key={auction.id} auction={auction} />
        </section>
        <AuctionLots auctionId={auction.id} lots={lots} />
      </div>
    </div>
  );
}
