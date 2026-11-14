import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import AuctionForm from "@/components/admin/AuctionForm";
import { adminUser, lastAuctionDefaults } from "@/lib/auctionsServer";
import { PLATFORM_NAME } from "@/lib/brand";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Novo leilão — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

// Novo leilão: começa com as regras, o Pix e o frete do leilão mais recente.
export default async function NewAuctionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/leiloes/novo");
  if (!(await adminUser())) notFound();

  const [defaults, shop] = await Promise.all([lastAuctionDefaults(), ownShop(supabase, user.id)]);

  return (
    <div className="app-shell">
      <AccountHeader title="Novo leilão" email={user.email ?? null} shop={shop} />
      <div className="admin-page">
        <nav className="adm-crumbs">
          <Link href="/admin/leiloes">← Leilões</Link>
        </nav>
        <section className="admin-section">
          <h2 className="admin-section-title">Novo leilão</h2>
          <p className="adm-updated">Depois de criar, você cadastra os lotes na página do leilão.</p>
          <AuctionForm auction={null} defaults={defaults} />
        </section>
      </div>
    </div>
  );
}
