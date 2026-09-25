"use client";

import { useMemo, useState } from "react";
import { BLOCKS, stickerName } from "@/lib/album";
import { matchesSticker } from "@/lib/derive";
import {
  centsToInput,
  describeSticker,
  formatBRL,
  parseBRL,
  priceFor,
  type Order,
  type OrderItem,
  type ShopPricing,
} from "@/lib/shop";

interface OrderEditorProps {
  order: Order;
  /** Repetidas em estoque por código (qty - 1). */
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
  qty: number;
  unit: string; // input em reais ("2,50")
}

const ALL_CODES = BLOCKS.flatMap((b) => b.codes);

export default function OrderEditor({ order, stock, reservedOthers, pricing, saving, onSave, onCancel }: OrderEditorProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    order.items.map((it) => ({ code: it.code, qty: it.qty, unit: centsToInput(it.unit_cents) }))
  );
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Máximo que este pedido pode ter de cada código: repetidas - reservas dos outros pedidos.
  const maxFor = (code: string) => Math.max((stock[code] ?? 0) - (reservedOthers[code] ?? 0), 0);

  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return [];
    const noPedido = new Set(rows.map((r) => r.code));
    return ALL_CODES.filter((c) => !noPedido.has(c) && matchesSticker(c, q)).slice(0, 8);
  }, [busca, rows]);

  function update(code: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, ...patch } : r)));
  }

  function adicionar(code: string) {
    setRows((prev) => [...prev, { code, qty: 1, unit: centsToInput(priceFor(code, pricing) ?? 0) }]);
    setBusca("");
  }

  const parsed = rows.map((r) => ({ ...r, cents: parseBRL(r.unit) }));
  const total = parsed.reduce((s, r) => s + (r.cents && !Number.isNaN(r.cents) ? r.cents * r.qty : 0), 0);

  function salvar() {
    setErro(null);
    if (!parsed.length) return setErro("O pedido precisa ter pelo menos um item — para desistir, cancele o pedido.");
    const invalido = parsed.find((r) => r.cents === null || Number.isNaN(r.cents));
    if (invalido) return setErro(`Preço inválido para ${invalido.code}. Use o formato 2,50.`);
    const excedido = parsed.find((r) => r.qty > maxFor(r.code));
    if (excedido) return setErro(`Só há ${maxFor(excedido.code)} disponível(is) de ${excedido.code}.`);
    onSave(parsed.map((r) => ({ code: r.code, qty: r.qty, unit_cents: r.cents as number })));
  }

  return (
    <div className="order-editor">
      {parsed.map((r) => {
        const max = maxFor(r.code);
        return (
          <div key={r.code} className="order-editor-row">
            <div className="cart-line-info">
              <span className="cart-line-code">{r.code}</span>
              <span className="cart-line-meta">
                {describeSticker(r.code)} · {max} disponíve{max === 1 ? "l" : "is"}
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
                aria-label={`Preço unitário de ${r.code}`}
              />
            </label>
            <span className="cart-line-total">
              {r.cents !== null && !Number.isNaN(r.cents) ? formatBRL(r.cents * r.qty) : "—"}
            </span>
            <button
              type="button"
              className="cart-line-remove"
              onClick={() => setRows((prev) => prev.filter((x) => x.code !== r.code))}
              aria-label={`Excluir ${r.code}`}
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
          placeholder="Incluir figurinha: código ou nome (ex: BRA9, messi)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {sugestoes.length > 0 && (
          <div className="order-editor-suggestions">
            {sugestoes.map((c) => {
              const max = maxFor(c);
              const nome = stickerName(c);
              return (
                <button key={c} type="button" disabled={max === 0} onClick={() => adicionar(c)}>
                  <strong>{c}</strong> {nome ?? describeSticker(c)}
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
