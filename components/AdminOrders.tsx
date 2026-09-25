"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ORDER_COLUMNS,
  describeSticker,
  formatAddress,
  formatBRL,
  formatDateTimeBR,
  isExpired,
  orderFromRow,
  orderMessage,
  reservedByCode,
  whatsappLink,
  type Order,
  type OrderItem,
  type OrderRow,
  type OrderStatus,
  type ShopPricing,
} from "@/lib/shop";
import type { Qtd } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import OrderEditor from "./OrderEditor";

interface AdminOrdersProps {
  orders: Order[];
  /** Repetidas em estoque (qty - 1), sem descontar reservas. */
  stock: Qtd;
  pricing: ShopPricing;
  onOrdersChange: Dispatch<SetStateAction<Order[]>>;
  onAvailableChange: Dispatch<SetStateAction<Qtd>>;
  onToast: (msg: string) => void;
}

type Filtro = OrderStatus | "ALL";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "novo", label: "Novos" },
  { value: "confirmado", label: "Confirmados" },
  { value: "cancelado", label: "Cancelados" },
  { value: "ALL", label: "Todos" },
];

// Status como o dono deve enxergar: pedido novo com prazo vencido já conta como expirado.
function effective(o: Order, now: number): { status: OrderStatus; label: string; css: string } {
  if (isExpired(o, now) || (o.status === "cancelado" && o.cancelReason === "expirado")) {
    return { status: "cancelado", label: "Expirado", css: "cancelado" };
  }
  const label = o.status === "novo" ? "Novo" : o.status === "confirmado" ? "Confirmado" : "Cancelado";
  return { status: o.status, label, css: o.status };
}

function restante(untilIso: string, now: number): string {
  const min = Math.max(0, Math.round((Date.parse(untilIso) - now) / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

// Erros de negócio (raise exception nas funções SQL) chegam como P0001 e já estão em português.
function mensagemErro(error: { code?: string; message: string }, fallback: string): string {
  return error.code === "P0001" ? error.message : fallback;
}

export default function AdminOrders({ orders, stock, pricing, onOrdersChange, onAvailableChange, onToast }: AdminOrdersProps) {
  const [filtro, setFiltro] = useState<Filtro>("novo");
  const [busy, setBusy] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const now = useNow();

  const visiveis = useMemo(
    () => (filtro === "ALL" ? orders : orders.filter((o) => effective(o, now).status === filtro)),
    [orders, filtro, now]
  );

  async function recarregar(id: string) {
    const { data } = await createClient().from("orders").select(ORDER_COLUMNS).eq("id", id).single<OrderRow>();
    if (data) onOrdersChange((prev) => prev.map((o) => (o.id === id ? orderFromRow(data) : o)));
  }

  async function mudarStatus(order: Order, status: OrderStatus) {
    const aviso =
      status === "confirmado"
        ? `Confirmar o pedido #${order.number}? As figurinhas serão baixadas da sua coleção.`
        : order.status === "confirmado"
          ? `Cancelar o pedido #${order.number}? As figurinhas voltam para a sua coleção.`
          : `Cancelar o pedido #${order.number}? A reserva das figurinhas é liberada.`;
    if (!window.confirm(aviso)) return;

    setBusy(order.id);
    const { error } = await createClient().rpc("set_order_status", { p_order_id: order.id, p_status: status });
    setBusy(null);

    if (error) {
      onToast(mensagemErro(error, "Não foi possível atualizar o pedido."));
      void recarregar(order.id);
      return;
    }

    const sinal = status === "confirmado" ? -1 : order.status === "confirmado" ? 1 : 0;
    if (sinal) {
      onAvailableChange((prev) => {
        const next = { ...prev };
        order.items.forEach((it) => {
          const n = (next[it.code] ?? 0) + sinal * it.qty;
          if (n > 0) next[it.code] = n;
          else delete next[it.code];
        });
        return next;
      });
    }
    await recarregar(order.id);
    onToast(
      status === "confirmado"
        ? `Pedido #${order.number} confirmado e estoque atualizado.`
        : `Pedido #${order.number} cancelado.`
    );
  }

  async function salvarItens(order: Order, items: OrderItem[]) {
    setBusy(order.id);
    const { error } = await createClient().rpc("update_order_items", { p_order_id: order.id, p_items: items });
    setBusy(null);
    if (error) {
      onToast(mensagemErro(error, "Não foi possível salvar o pedido."));
      return;
    }
    await recarregar(order.id);
    setEditando(null);
    onToast(`Pedido #${order.number} atualizado. Envie o resumo ao comprador pelo WhatsApp.`);
  }

  return (
    <div className="admin-page">
      <div className="controls-row">
        <div className="segmented">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`chip ${filtro === f.value ? "active" : ""}`}
              onClick={() => setFiltro(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="order-hint">
          Pedidos novos reservam as figurinhas por 5h. Sem confirmação nesse prazo, são cancelados e o estoque é
          liberado.
        </span>
      </div>

      {visiveis.length === 0 && (
        <div className="empty-message">
          {orders.length === 0 ? "Nenhum pedido recebido ainda. Compartilhe o link da loja!" : "Nenhum pedido nesse filtro."}
        </div>
      )}

      {visiveis.map((o) => {
        const ef = effective(o, now);
        const ativo = ef.status === "novo";
        const totalFigurinhas = o.items.reduce((s, it) => s + it.qty, 0);
        const resumo = whatsappLink(
          o.buyer.whatsapp,
          orderMessage(o.number, o.items, o.totalCents, o.buyer, ativo ? o.reservedUntil : undefined)
        );

        return (
          <article key={o.id} className="order-card">
            <header className="order-header">
              <span className="order-number">#{o.number}</span>
              <span className={`order-status order-status-${ef.css}`}>{ef.label}</span>
              <span className="order-date">{formatDateTimeBR(o.createdAt)}</span>
              {ativo && (
                <span className="order-reserve">
                  Reservado até {formatDateTimeBR(o.reservedUntil)} · restam {restante(o.reservedUntil, now)}
                </span>
              )}
              <div className="modal-header-spacer" />
              <span className="order-total">{formatBRL(o.totalCents)}</span>
            </header>

            <div className="order-body">
              <div className="order-buyer">
                <strong>{o.buyer.name}</strong>
                <a href={whatsappLink(o.buyer.whatsapp)} target="_blank" rel="noopener noreferrer">
                  WhatsApp: {o.buyer.whatsapp}
                </a>
                <a href={`mailto:${o.buyer.email}`}>{o.buyer.email}</a>
                <span>{formatAddress(o.buyer)}</span>
              </div>

              {editando === o.id ? (
                <OrderEditor
                  order={o}
                  stock={stock}
                  reservedOthers={reservedByCode(orders, now, o.id)}
                  pricing={pricing}
                  saving={busy === o.id}
                  onSave={(items) => void salvarItens(o, items)}
                  onCancel={() => setEditando(null)}
                />
              ) : (
                <div className="order-items">
                  <span className="order-items-title">
                    {totalFigurinhas} figurinha{totalFigurinhas === 1 ? "" : "s"}
                  </span>
                  {o.items.map((it) => (
                    <div key={it.code} className="order-item">
                      <span>
                        <strong>{it.code}</strong>{" "}
                        <span className="order-item-block">{describeSticker(it.code)}</span>
                      </span>
                      <span>
                        {it.qty} × {formatBRL(it.unit_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editando !== o.id && ef.status !== "cancelado" && (
              <footer className="modal-actions order-actions">
                {ativo && (
                  <button
                    type="button"
                    className="btn-restore"
                    disabled={busy === o.id}
                    onClick={() => void mudarStatus(o, "confirmado")}
                  >
                    Confirmar e dar baixa
                  </button>
                )}
                {ativo && (
                  <button type="button" className="btn-ghost" disabled={busy === o.id} onClick={() => setEditando(o.id)}>
                    Editar itens
                  </button>
                )}
                <a className="btn-ghost" href={resumo} target="_blank" rel="noopener noreferrer">
                  Enviar resumo ao comprador
                </a>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy === o.id}
                  onClick={() => void mudarStatus(o, "cancelado")}
                >
                  {o.status === "confirmado" ? "Cancelar e devolver ao estoque" : "Cancelar pedido"}
                </button>
              </footer>
            )}
          </article>
        );
      })}
    </div>
  );
}
