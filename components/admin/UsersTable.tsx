"use client";

import { useMemo, useState } from "react";
import type { AdminUser, UserKind } from "@/lib/adminStats";

// Lista de contas do painel: busca por nome/e-mail e filtro por tipo. Só leitura.

const KIND: Record<UserKind, string> = { assinante: "Assinante", colecionador: "Colecionador", "sem-colecao": "Sem coleção" };
const FILTERS: { value: UserKind | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "assinante", label: "Assinantes" },
  { value: "colecionador", label: "Colecionadores" },
  { value: "sem-colecao", label: "Sem coleção" },
];

const data = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" }) : "—";
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function UsersTable({ users }: { users: AdminUser[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<UserKind | "all">("all");

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter(
      (u) => (kind === "all" || u.kind === kind) && (!t || `${u.name} ${u.email} ${u.shop?.name ?? ""}`.toLowerCase().includes(t))
    );
  }, [users, q, kind]);

  return (
    <>
      <div className="adm-filters">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar por nome, e-mail ou loja"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="segmented">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" className={`chip ${kind === f.value ? "active" : ""}`} onClick={() => setKind(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <span className="adm-count">
          {rows.length} de {users.length}
        </span>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Tipo</th>
              <th>Criada</th>
              <th>Último acesso</th>
              <th>Coleções</th>
              <th>Loja</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name || "(sem nome)"}</strong>
                  <small>{u.email}</small>
                  {u.whatsapp && <small>{u.whatsapp}</small>}
                  {!u.confirmed && <em className="adm-tag is-warn">e-mail não confirmado</em>}
                </td>
                <td>
                  <em className={`adm-tag is-${u.kind}`}>{KIND[u.kind]}</em>
                </td>
                <td>{data(u.createdAt)}</td>
                <td>{data(u.lastSignInAt)}</td>
                <td>
                  {u.collections.length
                    ? u.collections.map((c) => (
                        <div key={c.albumId} className="adm-line">
                          {c.name}: <b>{c.items.toLocaleString("pt-BR")}</b>/{c.total}
                          {c.duplicates > 0 && <small> · {c.duplicates.toLocaleString("pt-BR")} repetidas</small>}
                        </div>
                      ))
                    : "—"}
                </td>
                <td>
                  {u.shop ? (
                    <>
                      <a href={u.shop.path} target="_blank" rel="noopener noreferrer">
                        {u.shop.name}
                      </a>
                      <small>
                        {u.shop.open ? "aberta" : u.shop.access ? "pausada" : "sem acesso"}
                        {u.shop.access && ` · ${u.shop.access === "stripe" ? `Stripe${u.shop.subscription ? ` (${u.shop.subscription})` : ""}` : "liberação manual"}`}
                      </small>
                      <small>
                        {u.shop.items.toLocaleString("pt-BR")} itens à venda
                        {u.shop.albums.length > 0 && ` (${u.shop.albums.map((a) => `${a.name}: ${a.items}`).join(", ")})`}
                      </small>
                      <small>
                        Pedidos: {u.shop.orders.novo} novos · {u.shop.orders.confirmado} confirmados ({brl(u.shop.confirmedCents)}) ·{" "}
                        {u.shop.orders.cancelado} cancelados
                      </small>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="adm-empty">
                  Nenhuma conta com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
