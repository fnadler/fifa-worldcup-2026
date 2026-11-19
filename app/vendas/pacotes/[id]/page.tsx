import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import LotForm from "@/components/packs/LotForm";
import LotFunnel from "@/components/packs/LotFunnel";
import LotPot from "@/components/packs/LotPot";
import LotStatusPanel from "@/components/packs/LotStatusPanel";
import { PLATFORM_NAME } from "@/lib/brand";
import { LOT_STATUS_LABEL } from "@/lib/packs";
import { loadFunnel, loadLot, packSeller } from "@/lib/packsServer";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Lote — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

// Um lote: dados, situação e o pote de Legends.
export default async function PackLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/vendas/pacotes/${id}`);
  const s = await packSeller();
  if (!s) notFound();

  const [data, shop] = await Promise.all([loadLot(s.supabase, user.id, id), ownShop(supabase, user.id)]);
  if (!data) notFound();
  const funnel = data.lot.status === "rascunho" ? null : await loadFunnel(data.lot.id);
  const { lot, pot, available, shopSlug, shopMinOrderCents } = data;
  const packs = Object.values(pot).reduce((a, b) => a + b, 0);

  return (
    <div className="app-shell">
      <AccountHeader title="Lote" email={user.email ?? null} shop={shop} />
      <div className="admin-page">
        <nav className="adm-crumbs">
          <Link href="/vendas/pacotes">← Pacotes</Link>
        </nav>
        <section className="admin-section">
          <div className="collections-head">
            <h2 className="admin-section-title">{lot.title}</h2>
            <span className={`adm-tag${lot.status === "ativo" ? " is-assinante" : lot.status === "pausado" ? " is-warn" : ""}`}>
              {LOT_STATUS_LABEL[lot.status]}
            </span>
          </div>
          <LotStatusPanel lotId={lot.id} status={lot.status} packs={packs} priceCents={lot.priceCents} shopSlug={shopSlug} lotSlug={lot.slug} />
        </section>
        {funnel && <LotFunnel funnel={funnel} />}
        <LotPot lotId={lot.id} editable={lot.status === "rascunho"} pot={pot} available={available} />
        <section className="admin-section">
          <h2 className="admin-section-title">Dados do lote</h2>
          <LotForm key={lot.id} lot={lot} shopSlug={shopSlug} shopMinOrderCents={shopMinOrderCents} />
        </section>
      </div>
    </div>
  );
}
