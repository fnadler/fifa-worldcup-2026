import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import LotForm from "@/components/packs/LotForm";
import { PLATFORM_NAME } from "@/lib/brand";
import { packSeller } from "@/lib/packsServer";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Novo lote — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

export default async function NewPackLotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/vendas/pacotes/novo");
  const s = await packSeller();
  if (!s) notFound();

  const [shop, { data: shopRow }, { count }] = await Promise.all([
    ownShop(supabase, user.id),
    supabase.from("shops").select("slug, order_min_cents").eq("user_id", user.id).maybeSingle<{ slug: string | null; order_min_cents: number | null }>(),
    supabase.from("pack_lots").select("id", { count: "exact", head: true }).eq("seller_id", user.id),
  ]);
  const n = (count ?? 0) + 1;

  return (
    <div className="app-shell">
      <AccountHeader title="Novo lote" email={user.email ?? null} shop={shop} />
      <div className="admin-page">
        <nav className="adm-crumbs">
          <Link href="/vendas/pacotes">← Pacotes</Link>
        </nav>
        <section className="admin-section">
          <h2 className="admin-section-title">Novo lote</h2>
          <p className="adm-updated">Depois de criar, você escolhe as Legends do pote na página do lote.</p>
          <LotForm
            lot={null}
            defaults={{ title: `Lote ${n}`, slug: `lote-${n}` }}
            shopSlug={shopRow?.slug ?? null}
            shopMinOrderCents={shopRow?.order_min_cents ?? 0}
          />
        </section>
      </div>
    </div>
  );
}
