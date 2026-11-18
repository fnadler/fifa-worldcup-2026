import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import { PLATFORM_NAME } from "@/lib/brand";
import { LOT_STATUS_LABEL } from "@/lib/packs";
import { listLots, packSeller } from "@/lib/packsServer";
import { formatBRL } from "@/lib/shop";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Pacotes — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

// Lotes de pacotes da loja. Só para lojas liberadas (pack_access); para as outras, 404.
export default async function PackLotsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/vendas/pacotes");
  const s = await packSeller();
  if (!s) notFound();

  const [lots, shop] = await Promise.all([listLots(s.supabase, user.id), ownShop(supabase, user.id)]);

  return (
    <div className="app-shell">
      <AccountHeader title="Pacotes" email={user.email ?? null} shop={shop} />
      <div className="admin-page">
        <nav className="adm-crumbs">
          <Link href="/vendas">← Minha loja</Link>
        </nav>
        <section className="admin-section">
          <div className="collections-head">
            <h2 className="admin-section-title">Lotes de pacotes</h2>
            <Link href="/vendas/pacotes/novo" className="btn-primary">
              + Novo lote
            </Link>
          </div>
          <p className="adm-updated">
            Cada pacote traz 1 Legend do pote do lote e mais 7 figurinhas da Copa 2026 das suas repetidas. O lote tem um
            pacote para cada Legend do pote.
          </p>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Situação</th>
                  <th>Pacotes</th>
                  <th>Preço</th>
                </tr>
              </thead>
              <tbody>
                {lots.length === 0 && (
                  <tr>
                    <td colSpan={4} className="adm-empty">
                      Nenhum lote ainda. Crie o primeiro e escolha as Legends do pote.
                    </td>
                  </tr>
                )}
                {lots.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/vendas/pacotes/${l.id}`}>
                        <strong>{l.title}</strong>
                      </Link>
                      <small>/{l.slug}</small>
                    </td>
                    <td>
                      <span className={`adm-tag${l.status === "ativo" ? " is-assinante" : l.status === "pausado" ? " is-warn" : ""}`}>
                        {LOT_STATUS_LABEL[l.status]}
                      </span>
                    </td>
                    <td>{l.legends}</td>
                    <td>{formatBRL(l.priceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
