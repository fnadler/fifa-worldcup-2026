import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import AuctionLive from "@/components/admin/AuctionLive";
import { adminUser, listBidders, loadAuction } from "@/lib/auctionsServer";
import { PLATFORM_NAME } from "@/lib/brand";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Leilão ao vivo — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

// Painel ao vivo do leilão: abre cada lote, marca o tempo, encerra e gera as mensagens do grupo.
export default async function AuctionLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/leiloes/${id}/ao-vivo`);
  if (!(await adminUser())) notFound();

  const [data, bidders, shop] = await Promise.all([loadAuction(id), listBidders(), ownShop(supabase, user.id)]);
  if (!data) notFound();

  return (
    <div className="app-shell">
      <AccountHeader title="Leilão ao vivo" email={user.email ?? null} shop={shop} />
      <div className="admin-page">
        <nav className="adm-crumbs">
          <Link href={`/admin/leiloes/${id}`}>← {data.auction.title}</Link>
        </nav>
        <AuctionLive auction={data.auction} lots={data.lots} bidders={bidders} />
      </div>
    </div>
  );
}
