"use client";

import { useMemo, useState } from "react";
import { getCatalog } from "@/lib/catalog";
import { matchesSticker } from "@/lib/derive";
import {
  centsToInput,
  formatBRL,
  isProductCode,
  itemLabel,
  parseBRL,
  priceFor,
  type Order,
  type OrderItem,
  type ShopPricing,
} from "@/lib/shop";

interface OrderEditorProps {
  order: Order;
  /** Estoque por código: repetidas (qty - 1) e produtos. */
  stock: Record<string, number>;
  /** Reservado por OUTROS pedidos novos dentro do prazo. */
  reservedOthers: Record<string, number>;
  pricing: ShopPricing;
  saving: boolean;
  onSave: (items: OrderItem[]) => void;
  onCancel: () => void;
}

interface Row {
  code: string;
  /** Título do produto (códigos "PRD:"), guardado no pedido. */
  name?: string;
  qty: number;
  unit: string; // input em reais ("2,50")
}

export default function OrderEditor({ order, stock, reservedOthers, pricing, saving, onSave, onCancel }: OrderEditorProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    order.items.map((it) => ({ code: it.code, name: it.name, qty: it.qty, unit: centsToInput(it.unit_cents) }))
  );
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  // Dá para incluir itens de qualquer coleção à venda e produtos da loja.
  const allCodes = useMemo(
    () => Object.keys(pricing.groups).flatMap((albumId) => getCatalog(albumId).blocks.flatMap((b) => b.codes)),
    [pricing.groups]
  );
  const nameOf = (r: { code: string; name?: string }) => r.name ?? pricing.products?.[r.code]?.title;
  const label = (r: { code: string; name?: string }) => itemLabel(r.code, nameOf(r));

  // Máximo que este pedido pode ter de cada código: repetidas - reservas dos outros pedidos.
  const maxFor = (code: string) => Math.max((stock[code] ?? 0) - (reservedOthers[code] ?? 0), 0);

  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return [];
    const noPedido = new Set(rows.map((r) => r.code));
    const produtos = Object.entries(pricing.products ?? {})
      .filter(([code, p]) => !noPedido.has(code) && p.title.toLowerCase().includes(q))
      .map(([code]) => code);
    return [...produtos, ...allCodes.filter((c) => !noPedido.has(c) && matchesSticker(c, q))].slice(0, 8);
  }, [allCodes, busca, rows, pricing.products]);

  function update(code: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, ...patch } : r)));
  }

  function adicionar(code: string) {
    setRows((prev) => [
      ...prev,
      { code, name: pricing.products?.[code]?.title, qty: 1, unit: centsToInput(priceFor(code, pricing) ?? 0) },
    ]);
    setBusca("");
  }

  const parsed = rows.map((r) => ({ ...r, cents: parseBRL(r.unit) }));
  const total = parsed.reduce((s, r) => s + (r.cents && !Number.isNaN(r.cents) ? r.cents * r.qty : 0), 0);

  function salvar() {
    setErro(null);
    if (!parsed.length) return setErro("O pedido precisa ter pelo menos um item — para desistir, cancele o pedido.");
    const invalido = parsed.find((r) => r.cents === null || Number.isNaN(r.cents));
    if (invalido) return setErro(`Preço inválido para ${label(invalido).title}. Use o formato 2,50.`);
    const excedido = parsed.find((r) => r.qty > maxFor(r.code));
    if (excedido) return setErro(`Só há ${maxFor(excedido.code)} disponível(is) de ${label(excedido).title}.`);
    onSave(
      parsed.map((r) => ({
        code: r.code,
        qty: r.qty,
        unit_cents: r.cents as number,
        ...(isProductCode(r.code) ? { name: nameOf(r) } : {}),
      }))
    );
  }

  return (
    <div className="order-editor">
      {parsed.map((r) => {
        const max = maxFor(r.code);
        const l = label(r);
        return (
          <div key={r.code} className="order-editor-row">
            <div className="cart-line-info">
              <span className="cart-line-code">{l.title}</span>
              <span className="cart-line-meta">
                {l.meta || l.group} · {max} disponíve{max === 1 ? "l" : "is"}
              </span>
            </div>
            <div className="stepper">
              <button type="button" onClick={() => update(r.code, { qty: r.qty - 1 })} disabled={r.qty <= 1} aria-label="Diminuir">
                −
              </button>
              <span>{r.qty}</span>
              <button type="button" onClick={() => update(r.code, { qty: r.qty + 1 })} disabled={r.qty >= max} aria-label="Aumentar">
                +
              </button>
            </div>
            <label className="order-editor-price">
              R$
              <input
                className="login-input"
                inputMode="decimal"
                value={r.unit}
                onChange={(e) => update(r.code, { unit: e.target.value })}
                aria-label={`Preço unitário de ${l.title}`}
              />
            </label>
            <span className="cart-line-total">
              {r.cents !== null && !Number.isNaN(r.cents) ? formatBRL(r.cents * r.qty) : "—"}
            </span>
            <button
              type="button"
              className="cart-line-remove"
              onClick={() => setRows((prev) => prev.filter((x) => x.code !== r.code))}
              aria-label={`Excluir ${l.title}`}
            >
              ×
            </button>
          </div>
        );
      })}

      <div className="order-editor-add">
        <input
          type="search"
          className="search-input"
          placeholder="Incluir item: código, nº, nome ou produto (ex: messi)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {sugestoes.length > 0 && (
          <div className="order-editor-suggestions">
            {sugestoes.map((c) => {
              const max = maxFor(c);
              const l = label({ code: c });
              return (
                <button key={c} type="button" disabled={max === 0} onClick={() => adicionar(c)}>
                  <strong>{l.title}</strong> {l.meta || l.group}
                  <span>{max === 0 ? "indisponível" : `${max} disp.`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {erro && <div className="login-error">{erro}</div>}

      <div className="order-editor-footer">
        <span className="cart-total-row">
          <span>Novo total</span>
          <span className="cart-total-value">{formatBRL(total)}</span>
        </span>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
            Descartar
          </button>
          <button type="button" className="btn-restore" onClick={salvar} disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
