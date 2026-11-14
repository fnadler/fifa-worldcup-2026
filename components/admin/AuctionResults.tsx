"use client";

import { useState, useTransition } from "react";
import { saveSettlement, type SettlementInput } from "@/app/admin/leiloes/actions";
import { brl, chargeTexts, finalText, trackingText, type Bidder, type Charge } from "@/lib/auctionMessages";
import { LOT_STATUS_LABEL, type Auction, type AuctionLot } from "@/lib/auctions";
import type { Settlement } from "@/lib/auctionsServer";
import { copyText } from "@/lib/clipboard";
import { maskPhoneBR } from "@/lib/phone";

// Resultado do leilão: lotes encerrados, cobrança por arrematante (um Pix com todos os lotes) e o
// controle de pagamento, envio e rastreio de cada um.

const waLink = (whatsapp: string, text: string) => `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

function SettlementCard({ auctionId, charge, settlement }: { auctionId: string; charge: Charge; settlement: Settlement | undefined }) {
  const [v, setV] = useState<SettlementInput>({
    paid: !!settlement?.paidAt,
    shipped: !!settlement?.shippedAt,
    delivered: !!settlement?.deliveredAt,
    trackingCode: settlement?.trackingCode ?? "",
    trackingUrl: settlement?.trackingUrl ?? "",
    notes: settlement?.notes ?? "",
  });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (patch: Partial<SettlementInput>) => {
    setV({ ...v, ...patch });
    setDirty(true);
    setNote(null);
  };

  function salvar() {
    setError(null);
    start(async () => {
      const r = await saveSettlement(auctionId, charge.bidderId, v);
      if (!r.ok) return setError(r.error);
      setDirty(false);
      setNote("Salvo ✓");
    });
  }

  async function copiar(text: string) {
    setNote((await copyText(text)) ? "Mensagem copiada ✓" : "Não deu para copiar.");
  }

  const tracking = v.trackingCode || v.trackingUrl ? trackingText(charge.name, v.trackingCode.trim().toUpperCase(), v.trackingUrl.trim()) : null;
  const status = v.delivered ? "Entregue" : v.shipped ? "Enviado" : v.paid ? "Pago" : "Aguardando Pix";

  return (
    <article className={`result-card${v.paid ? " is-paid" : ""}`}>
      <div className="result-card-head">
        <div>
          <strong>{charge.name || "Sem nome"}</strong>
          <small>
            {maskPhoneBR(charge.whatsapp)} · {charge.count} {charge.count === 1 ? "lote" : "lotes"} · <b>{brl(charge.totalCents)}</b>
          </small>
        </div>
        <span className={`adm-tag${v.paid ? " is-colecionador" : " is-warn"}`}>{status}</span>
      </div>

      <div className="live-row">
        <a className="btn-primary live-wa" href={waLink(charge.whatsapp, charge.text)} target="_blank" rel="noopener noreferrer">
          Enviar cobrança no WhatsApp
        </a>
        <button type="button" className="btn-ghost" onClick={() => void copiar(charge.text)}>
          Copiar cobrança
        </button>
      </div>
      <details className="result-preview">
        <summary>Ver mensagem de cobrança</summary>
        <pre className="wa-text">{charge.text}</pre>
      </details>

      {settlement ? (
        <>
          <div className="result-checks">
            <label className="check-inline">
              <input type="checkbox" checked={v.paid} onChange={(e) => set({ paid: e.target.checked })} />
              Pago {settlement.paidAt && v.paid && <small>{shortDate(settlement.paidAt)}</small>}
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={v.shipped} onChange={(e) => set({ shipped: e.target.checked })} />
              Enviado {settlement.shippedAt && v.shipped && <small>{shortDate(settlement.shippedAt)}</small>}
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={v.delivered} onChange={(e) => set({ delivered: e.target.checked })} />
              Entregue {settlement.deliveredAt && v.delivered && <small>{shortDate(settlement.deliveredAt)}</small>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label form-narrow">
              Código de rastreio
              <input className="login-input" maxLength={60} placeholder="AA123456789BR" value={v.trackingCode} onChange={(e) => set({ trackingCode: e.target.value })} />
            </label>
            <label className="form-label">
              Link de acompanhamento
              <input
                className="login-input"
                inputMode="url"
                maxLength={500}
                placeholder="https://rastreamento.correios.com.br/…"
                value={v.trackingUrl}
                onChange={(e) => set({ trackingUrl: e.target.value })}
              />
            </label>
          </div>
          <label className="form-label">
            Observação
            <input className="login-input" maxLength={500} placeholder="Ex: CEP, frete combinado, retirada…" value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
          {error && <div className="login-error">{error}</div>}
          <div className="live-row">
            <button type="button" className="btn-primary" onClick={salvar} disabled={pending || !dirty}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
            {tracking && (
              <>
                <a className="btn-ghost" href={waLink(charge.whatsapp, tracking)} target="_blank" rel="noopener noreferrer">
                  Enviar rastreio no WhatsApp
                </a>
                {v.trackingUrl && /^https?:\/\//i.test(v.trackingUrl.trim()) && (
                  <a className="btn-ghost" href={v.trackingUrl.trim()} target="_blank" rel="noopener noreferrer">
                    Abrir rastreio
                  </a>
                )}
              </>
            )}
            {note && <span className="auction-saved">{note}</span>}
          </div>
        </>
      ) : (
        <p className="field-hint">Sem registro de pagamento para este arrematante. Encerre o lote de novo pelo painel ao vivo.</p>
      )}
    </article>
  );
}

export default function AuctionResults({
  auction,
  lots,
  bidders,
  settlements,
}: {
  auction: Auction;
  lots: AuctionLot[];
  bidders: Record<string, Bidder>;
  settlements: Settlement[];
}) {
  const [copied, setCopied] = useState(false);
  const charges = chargeTexts(auction, lots, bidders).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const byBidder = new Map(settlements.map((s) => [s.bidderId, s]));
  const done = lots.filter((l) => l.status === "arrematado" || l.status === "sem_lance");
  const sold = lots.filter((l) => l.status === "arrematado");
  const soldTotal = sold.reduce((s, l) => s + (l.soldCents ?? 0), 0);
  const paidTotal = charges.filter((c) => byBidder.get(c.bidderId)?.paidAt).reduce((s, c) => s + c.totalCents, 0);
  const final = finalText(auction, lots, bidders);

  return (
    <>
      <section className="admin-section">
        <h2 className="admin-section-title">Resumo</h2>
        <div className="adm-kpis">
          <div className="adm-kpi">
            <span>Lotes encerrados</span>
            <strong>
              {done.length} de {lots.length}
            </strong>
            <small>{sold.length} arrematados</small>
          </div>
          <div className="adm-kpi">
            <span>Arrematado</span>
            <strong>{brl(soldTotal)}</strong>
            <small>{charges.length} {charges.length === 1 ? "arrematante" : "arrematantes"}</small>
          </div>
          <div className="adm-kpi">
            <span>Recebido</span>
            <strong>{brl(paidTotal)}</strong>
            <small>falta receber {brl(soldTotal - paidTotal)}</small>
          </div>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Lotes</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Lote</th>
                <th>Arrematante</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l, i) => {
                const b = l.bidderId ? bidders[l.bidderId] : undefined;
                return (
                  <tr key={l.id}>
                    <td>{i + 1}</td>
                    <td>
                      <strong>{l.name}</strong>
                      <small>lance inicial {brl(l.startCents)}</small>
                    </td>
                    <td>
                      {l.status === "arrematado" && b ? (
                        <>
                          <strong>{b.name}</strong>
                          <small>{maskPhoneBR(b.whatsapp)}</small>
                        </>
                      ) : (
                        <span className="adm-tag">{LOT_STATUS_LABEL[l.status]}</span>
                      )}
                    </td>
                    <td>{l.status === "arrematado" && l.soldCents !== null ? <b>{brl(l.soldCents)}</b> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Cobrança e envio</h2>
        <p className="adm-updated">Uma cobrança por arrematante, com todos os lotes dele e um frete só.</p>
        {charges.length === 0 && <div className="empty-message">Nenhum lote arrematado ainda.</div>}
        <div className="result-cards">
          {charges.map((c) => (
            <SettlementCard key={c.bidderId} auctionId={auction.id} charge={c} settlement={byBidder.get(c.bidderId)} />
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="collections-head">
          <h2 className="admin-section-title">Mensagem de encerramento</h2>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              setCopied(await copyText(final));
              setTimeout(() => setCopied(false), 1800);
            }}
          >
            {copied ? "Copiado ✓" : "Copiar"}
          </button>
        </div>
        <pre className="wa-text">{final}</pre>
      </section>
    </>
  );
}
