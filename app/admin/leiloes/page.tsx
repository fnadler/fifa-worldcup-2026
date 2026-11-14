import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import { AUCTION_STATUS_LABEL, formatAuctionDate } from "@/lib/auctions";
import { adminUser, listAuctions } from "@/lib/auctionsServer";
import { PLATFORM_NAME } from "@/lib/brand";
import { formatBRL } from "@/lib/shop";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Leilões — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

// Lista dos leilões da comunidade. Só para o admin da plataforma; para qualquer outra conta, 404.
export default async function AuctionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/leiloes");
  if (!(await adminUser())) notFound();

  const [auctions, shop] = await Promise.all([listAuctions(), ownShop(supabase, user.id)]);

  return (
    <div className="app-shell">
      <AccountHeader title="Leilões" email={user.email ?? null} shop={shop} />
      <div className="admin-page">
        <nav className="adm-crumbs">
          <Link href="/admin">← Painel administrativo</Link>
        </nav>
        <section className="admin-section">
          <div className="collections-head">
            <h2 className="admin-section-title">Leilões</h2>
            <Link href="/admin/leiloes/novo" className="btn-primary">
              + Novo leilão
            </Link>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Leilão</th>
                  <th>Situação</th>
                  <th>Lotes</th>
                  <th>Lances iniciais</th>
                  <th>Arrematado</th>
                  <th>Recebido</th>
                </tr>
              </thead>
              <tbody>
                {auctions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="adm-empty">
                      Nenhum leilão cadastrado ainda.
                    </td>
                  </tr>
                )}
                {auctions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/admin/leiloes/${a.id}`}>
                        <strong>{a.title}</strong>
                      </Link>
                      <small>{formatAuctionDate(a.startsAt)}</small>
                    </td>
                    <td>
                      <span className={`adm-tag${a.status === "ao_vivo" ? " is-warn" : a.status === "encerrado" ? " is-colecionador" : ""}`}>
                        {AUCTION_STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td>{a.lots}</td>
                    <td>{formatBRL(a.startTotalCents)}</td>
                    <td>
                      {a.sold > 0 ? (
                        <>
                          <b>{formatBRL(a.soldTotalCents)}</b>
                          <small>
                            {a.sold} de {a.lots} lotes
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {a.sold > 0 ? (
                        <Link href={`/admin/leiloes/${a.id}/resultado`}>
                          <b>{formatBRL(a.paidTotalCents)}</b>
                          <small>falta {formatBRL(a.soldTotalCents - a.paidTotalCents)}</small>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
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
