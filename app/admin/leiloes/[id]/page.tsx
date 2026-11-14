import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import AuctionForm from "@/components/admin/AuctionForm";
import AuctionLots from "@/components/admin/AuctionLots";
import AuctionMessages from "@/components/admin/AuctionMessages";
import { middayText, openingText, predictedEnd, reminderText, reminderTime, rulesText, hhmm } from "@/lib/auctionMessages";
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
  const count = lots.length;
  const start = hhmm(auction.startsAt);
  const messages = [
    { key: "regras", label: "Regras · fixar no grupo", text: rulesText(auction, count) },
    ...(auction.announcement ? [{ key: "divulgacao", label: "Divulgação", text: auction.announcement }] : []),
    { key: "dia", label: "Lembrete do dia · sugestão 13:30", text: middayText(auction) },
    { key: "1h", label: `1 hora antes · ${reminderTime(auction)}`, text: reminderText(auction) },
    { key: "abertura", label: `Abertura · ${start}`, text: openingText(auction, count) },
  ];

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
          <p className="adm-updated">
            {formatAuctionDate(auction.startsAt)}
            {count > 0 && ` · ${count} lotes · término previsto ${hhmm(predictedEnd(auction, count))}`}
          </p>
          {count > 0 && (
            <div className="live-row">
              <Link href={`/admin/leiloes/${auction.id}/ao-vivo`} className="btn-primary">
                {auction.status === "ao_vivo" ? "Voltar ao painel ao vivo" : "Abrir painel ao vivo"}
              </Link>
            </div>
          )}
          <AuctionForm key={auction.id} auction={auction} />
        </section>
        <AuctionLots auctionId={auction.id} lots={lots} />
        <section className="admin-section">
          <h2 className="admin-section-title">Mensagens antes do leilão</h2>
          <p className="adm-updated">Geradas a partir dos dados acima. Salve as alterações para atualizar.</p>
          <AuctionMessages items={messages} />
        </section>
      </div>
    </div>
  );
}
