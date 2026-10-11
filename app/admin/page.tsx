import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AccountHeader from "@/components/AccountHeader";
import GrowthChart from "@/components/admin/GrowthChart";
import UsersTable from "@/components/admin/UsersTable";
import { isAdmin, loadAdminStats } from "@/lib/adminStats";
import { PLATFORM_NAME } from "@/lib/brand";
import { formatBRL } from "@/lib/shop";
import { ownShop } from "@/lib/shopLink";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Painel — ${PLATFORM_NAME}`, robots: { index: false, follow: false } };

const n = (v: number) => v.toLocaleString("pt-BR");

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="adm-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

// Painel administrativo: só leitura, só para a conta dona da plataforma. Para qualquer outra conta a
// página não existe (404) — os dados são lidos com a service_role, então a checagem vem antes de tudo.
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user)) notFound();

  const [stats, shop] = await Promise.all([loadAdminStats(), ownShop(supabase, user.id)]);
  const t = stats.totals;
  const lojas = stats.users.filter((u) => u.shop).sort((a, b) => (b.shop?.items ?? 0) - (a.shop?.items ?? 0));
  const atualizado = new Date(stats.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  return (
    <div className="app-shell">
      <AccountHeader title="Painel administrativo" email={user.email ?? null} shop={shop} />

      <div className="admin-page">
        <p className="adm-updated">Somente leitura · dados de {atualizado} (recarregue a página para atualizar)</p>

        <section className="admin-section">
          <h2 className="admin-section-title">Visão geral</h2>
          <div className="adm-kpis">
            <Kpi label="Contas" value={n(t.accounts)} hint={`${n(t.confirmed)} com e-mail confirmado`} />
            <Kpi label="Colecionadores" value={n(t.colecionadores)} hint="têm coleção, sem loja ativa" />
            <Kpi
              label="Assinantes"
              value={n(t.assinantes)}
              hint={`loja ativa · ${n(t.assinantesStripe)} pelo Stripe, ${n(t.assinantes - t.assinantesStripe)} liberação manual`}
            />
            <Kpi label="Sem coleção" value={n(t.semColecao)} hint="criaram conta e não escolheram coleção" />
            <Kpi label="Contas novas" value={n(t.new7)} hint={`nos últimos 7 dias · ${n(t.new30)} em 30 dias`} />
            <Kpi label="Contas ativas" value={n(t.active7)} hint={`entraram nos últimos 7 dias · ${n(t.active30)} em 30 dias`} />
            <Kpi label="Coleções criadas" value={n(t.collections)} hint={`${n(t.items)} itens marcados no total`} />
            <Kpi label="Lojas" value={n(t.shopsCreated)} hint={`${n(t.shopsOpen)} abertas · ${n(t.shopItems)} itens à venda`} />
            <Kpi
              label="Pedidos"
              value={n(t.orders.novo + t.orders.confirmado + t.orders.cancelado)}
              hint={`${n(t.orders.confirmado)} confirmados (${formatBRL(t.confirmedCents)}) · ${n(t.orders.novo)} novos · ${n(t.orders.cancelado)} cancelados`}
            />
          </div>
        </section>

        <section className="admin-section">
          <h2 className="admin-section-title">Evolução</h2>
          <GrowthChart series={stats.series} />
        </section>

        <section className="admin-section">
          <h2 className="admin-section-title">Coleções</h2>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Coleção</th>
                  <th>Coleções criadas</th>
                  <th>Itens marcados</th>
                  <th>Média por coleção</th>
                  <th>Repetidas</th>
                  <th>Lojas vendendo</th>
                  <th>Itens à venda</th>
                </tr>
              </thead>
              <tbody>
                {stats.albums.map((a) => (
                  <tr key={a.albumId}>
                    <td>
                      <strong>{a.name}</strong>
                      <small>{n(a.total)} itens no catálogo</small>
                    </td>
                    <td>{n(a.collections)}</td>
                    <td>{n(a.items)}</td>
                    <td>
                      {a.collections ? n(Math.round(a.items / a.collections)) : "—"}
                      {a.collections > 0 && <small>{Math.min(100, Math.round((a.items / a.collections / a.total) * 100))}% do catálogo</small>}
                    </td>
                    <td>{n(a.duplicates)}</td>
                    <td>{n(a.shops)}</td>
                    <td>{n(a.shopItems)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2 className="admin-section-title">Lojas</h2>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>Situação</th>
                  <th>Itens à venda</th>
                  <th>Pedidos novos</th>
                  <th>Confirmados</th>
                  <th>Cancelados</th>
                  <th>Vendido</th>
                </tr>
              </thead>
              <tbody>
                {lojas.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <a href={u.shop!.path} target="_blank" rel="noopener noreferrer">
                        {u.shop!.name}
                      </a>
                      <small>{u.name || u.email}</small>
                    </td>
                    <td>
                      <em className={`adm-tag ${u.shop!.open ? "is-assinante" : "is-warn"}`}>
                        {u.shop!.open ? "Aberta" : u.shop!.access ? "Pausada" : "Sem acesso"}
                      </em>
                      {u.shop!.access && (
                        <small>
                          {u.shop!.access === "stripe" ? `Stripe${u.shop!.subscription ? ` (${u.shop!.subscription})` : ""}` : "liberação manual"}
                        </small>
                      )}
                    </td>
                    <td>
                      {n(u.shop!.items)}
                      {u.shop!.albums.map((a) => (
                        <small key={a.name}>
                          {a.name}: {n(a.items)}
                        </small>
                      ))}
                    </td>
                    <td>{n(u.shop!.orders.novo)}</td>
                    <td>{n(u.shop!.orders.confirmado)}</td>
                    <td>{n(u.shop!.orders.cancelado)}</td>
                    <td>{formatBRL(u.shop!.confirmedCents)}</td>
                  </tr>
                ))}
                {lojas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="adm-empty">
                      Nenhuma loja criada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <h2 className="admin-section-title">Contas</h2>
          <UsersTable users={stats.users} />
        </section>
      </div>
    </div>
  );
}
