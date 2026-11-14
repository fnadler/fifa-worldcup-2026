"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  closeLot,
  extendLot,
  finishAuction,
  openLot,
  reopenLot,
  resetAuction,
  selectLot,
} from "@/app/admin/leiloes/actions";
import {
  brl,
  confirmText,
  extendText,
  finalText,
  hhmm,
  noBidText,
  oneMinuteText,
  openLotText,
  slotTime,
  soldText,
  type Bidder,
} from "@/lib/auctionMessages";
import { LOT_STATUS_LABEL, type Auction, type AuctionLot } from "@/lib/auctions";
import { copyImage, copyText } from "@/lib/clipboard";
import { isValidPhoneBR, maskPhoneBR, normalizeWhatsapp } from "@/lib/phone";
import { useNow } from "@/lib/useNow";

// Painel ao vivo: um lote por vez. O cronômetro vem do banco (closes_at); os campos de maior lance,
// nome e WhatsApp são rascunho deste navegador até o lote ser encerrado.

interface BidderRow extends Bidder {
  id: string;
}

interface Draft {
  bid: string;
  name: string;
  wa: string;
}

const EMPTY_DRAFT: Draft = { bid: "", name: "", wa: "" };
const centsOf = (s: string) => {
  const t = s.replace(/R\$|\s/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

export default function AuctionLive({ auction, lots, bidders }: { auction: Auction; lots: AuctionLot[]; bidders: BidderRow[] }) {
  const total = lots.length;
  const firstPending = lots.find((l) => l.status === "aguardando" || l.status === "aberto")?.id ?? lots[0]?.id ?? null;
  const [curId, setCurId] = useState<string | null>(
    auction.currentLotId && lots.some((l) => l.id === auction.currentLotId) ? auction.currentLotId : firstPending
  );
  const idx = Math.max(0, lots.findIndex((l) => l.id === curId));
  const lot = lots[idx] ?? null;
  const n = idx + 1;

  const [closesOverride, setClosesOverride] = useState<Record<string, string | null>>({});
  const closesAt = lot ? (lot.id in closesOverride ? closesOverride[lot.id] : lot.closesAt) : null;
  const now = useNow(250);

  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Rascunho por lote, guardado neste navegador.
  const draftKey = `leilao:${auction.id}`;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(draftKey) ?? "{}");
      if (saved && typeof saved === "object") queueMicrotask(() => setDrafts(saved));
    } catch {
      // rascunho é só conveniência
    }
  }, [draftKey]);
  const draft = (lot && drafts[lot.id]) || EMPTY_DRAFT;
  function setDraft(patch: Partial<Draft>) {
    if (!lot) return;
    setDrafts((prev) => {
      const next = { ...prev, [lot.id]: { ...(prev[lot.id] ?? EMPTY_DRAFT), ...patch } };
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(next));
      } catch {
        // conveniência apenas
      }
      return next;
    });
  }

  const byId = useMemo(() => Object.fromEntries(bidders.map((b) => [b.id, b])) as Record<string, BidderRow>, [bidders]);
  const byWa = useMemo(() => new Map(bidders.map((b) => [b.whatsapp, b])), [bidders]);
  const waOk = isValidPhoneBR(draft.wa);
  const known = waOk ? byWa.get(normalizeWhatsapp(draft.wa)) : undefined;

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 2200);
  }

  // Copia já no clique (o navegador exige), mostra no campo "Mensagem do momento".
  function say(text: string) {
    setMsg(text);
    void copyText(text).then((ok) => flash(ok ? "Mensagem copiada. Cole no grupo." : "Não deu para copiar: selecione o texto abaixo."));
  }

  function run<T>(action: () => Promise<{ ok: true } & T | { ok: false; error: string }>, after?: (r: T) => void) {
    setError(null);
    start(async () => {
      const r = await action();
      if (!r.ok) return setError(r.error);
      after?.(r as unknown as T);
    });
  }

  function irPara(i: number) {
    const target = lots[i];
    if (!target) return;
    setCurId(target.id);
    setArmed(null);
    setError(null);
    void selectLot(auction.id, target.id);
  }

  // ---------- ações ----------

  function abrir() {
    if (!lot) return;
    const end = new Date(Date.now() + auction.lotMinutes * 60000);
    setClosesOverride((o) => ({ ...o, [lot.id]: end.toISOString() }));
    say(openLotText(auction, lot, n, total, end));
    run<{ closesAt: string }>(() => openLot(auction.id, lot.id), (r) => setClosesOverride((o) => ({ ...o, [lot.id]: r.closesAt })));
  }

  function prorrogar() {
    if (!lot) return;
    const base = Math.max(Date.now(), closesAt ? new Date(closesAt).getTime() : 0);
    const end = new Date(base + auction.extensionMinutes * 60000);
    setClosesOverride((o) => ({ ...o, [lot.id]: end.toISOString() }));
    say(extendText(n, end));
    run<{ closesAt: string }>(() => extendLot(auction.id, lot.id), (r) => setClosesOverride((o) => ({ ...o, [lot.id]: r.closesAt })));
  }

  function encerrarComArremate() {
    if (!lot) return;
    const cents = centsOf(draft.bid);
    if (cents === null || cents < lot.startCents) return setError(`Informe o maior lance (mínimo ${brl(lot.startCents)}).`);
    const name = draft.name.trim() || known?.name || "";
    if (!name) return setError("Informe o nome de quem arrematou.");
    if (!waOk) return setError("Informe o WhatsApp de quem arrematou, com DDD.");
    say(soldText(lot, n, total, name, cents));
    run(() => closeLot(auction.id, lot.id, { cents: draft.bid, name, whatsapp: draft.wa }));
  }

  function encerrarSemLance() {
    if (!lot) return;
    say(noBidText(n, total));
    run(() => closeLot(auction.id, lot.id, null));
  }

  function armar(key: string, then: () => void) {
    if (armed !== key) {
      setArmed(key);
      setTimeout(() => setArmed((a) => (a === key ? null : a)), 4000);
      return;
    }
    setArmed(null);
    then();
  }

  function corrigir() {
    if (!lot) return;
    armar("corrigir", () =>
      run(() => reopenLot(auction.id, lot.id), () => {
        setClosesOverride((o) => ({ ...o, [lot.id]: null }));
        flash("Resultado desfeito. O lote voltou para “aguardando”.");
      })
    );
  }

  function reiniciar() {
    armar("reiniciar", () =>
      run(() => resetAuction(auction.id), () => {
        setClosesOverride({});
        setDrafts({});
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          // conveniência apenas
        }
        setCurId(lots[0]?.id ?? null);
        setMsg("");
        flash("Leilão reiniciado. Todos os lotes voltaram para “aguardando”.");
      })
    );
  }

  function encerrarLeilao() {
    armar("fim", () => run(() => finishAuction(auction.id), () => flash("Leilão encerrado.")));
  }

  async function copiarFoto() {
    if (!lot?.imageUrl) return;
    const ok = await copyImage(lot.imageUrl);
    flash(ok ? `Foto do lote ${n} copiada. Cole no grupo.` : "Não deu para copiar a foto. Clique com o botão direito nela e escolha “Copiar imagem”.");
  }

  if (!lot) {
    return (
      <section className="admin-section">
        <div className="empty-message">
          Este leilão ainda não tem lotes. <Link href={`/admin/leiloes/${auction.id}`}>Cadastre os lotes</Link> primeiro.
        </div>
      </section>
    );
  }

  // ---------- cronômetro ----------
  const closed = lot.status === "arrematado" || lot.status === "sem_lance";
  const left = lot.status === "aberto" && closesAt ? Math.round((new Date(closesAt).getTime() - now) / 1000) : null;
  const clock =
    left === null ? `${auction.lotMinutes}:00` : left <= 0 ? "0:00" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const clockClass = left === null ? "" : left <= 0 ? " is-over" : left <= 60 ? " is-warn" : "";
  const winner = lot.bidderId ? byId[lot.bidderId] : undefined;
  const clockNote = closed
    ? lot.status === "arrematado"
      ? `Encerrado: ${winner?.name ?? ""} · ${brl(lot.soldCents ?? 0)}`
      : "Encerrado sem lance"
    : left === null
      ? "Clique em “Abrir lote” para começar."
      : left <= 0
        ? "Tempo esgotado. Confira o último lance e encerre."
        : `Encerra às ${hhmm(closesAt!)}${left <= 60 ? " · último minuto" : ""}`;

  const confirm = lot.status === "arrematado" && winner ? confirmText(auction, lot, n, total, winner.name, lot.soldCents ?? 0) : null;
  const doneCount = lots.filter((l) => l.status === "arrematado" || l.status === "sem_lance").length;
  const soldTotal = lots.reduce((s, l) => s + (l.status === "arrematado" ? (l.soldCents ?? 0) : 0), 0);
  const allDone = doneCount === total;

  return (
    <>
      <section className="admin-section live-panel">
        <div className="live-grid">
          <div className="live-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário */}
            {lot.imageUrl ? <img src={lot.imageUrl} alt={`Foto do lote ${n}: ${lot.name}`} /> : <p className="live-nophoto">Este lote não tem foto.</p>}
            <div className="live-row">
              <button type="button" className="btn-primary" onClick={() => void copiarFoto()} disabled={!lot.imageUrl}>
                1 · Copiar foto
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => say(openLotText(auction, lot, n, total, closesAt && lot.status === "aberto" ? new Date(closesAt) : new Date(Date.now() + auction.lotMinutes * 60000)))}
              >
                Copiar mensagem do lote
              </button>
            </div>
          </div>

          <div className="live-info">
            <span className="live-kicker">
              Lote {n} de {total} · previsto {slotTime(auction, idx)} · {LOT_STATUS_LABEL[lot.status]}
            </span>
            <strong className="live-name">{lot.name}</strong>
            {lot.detail && <span className="live-detail">{lot.detail}</span>}
            <span className="live-start">
              Lance inicial <b>{brl(lot.startCents)}</b>
            </span>
            <div className={`live-clock${clockClass}`}>{clock}</div>
            <span className="live-clock-note">{clockNote}</span>

            {!closed && (
              <>
                <div className="live-row">
                  <button type="button" className="btn-primary" onClick={abrir} disabled={pending}>
                    {lot.status === "aberto" ? "Reiniciar cronômetro" : "2 · Abrir lote"}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => say(oneMinuteText(lot, n, centsOf(draft.bid)))}>
                    Falta 1 minuto
                  </button>
                  <button type="button" className="btn-ghost" onClick={prorrogar} disabled={pending || lot.status !== "aberto"}>
                    Prorrogar +{auction.extensionMinutes} min
                  </button>
                </div>
                <div className="form-row">
                  <label className="form-label form-narrow">
                    Maior lance (R$)
                    <input className="login-input" inputMode="decimal" value={draft.bid} onChange={(e) => setDraft({ bid: e.target.value })} />
                  </label>
                  <label className="form-label">
                    WhatsApp de quem arrematou
                    <input
                      className="login-input"
                      inputMode="tel"
                      placeholder="(51) 99999-9999"
                      value={maskPhoneBR(draft.wa)}
                      onChange={(e) => setDraft({ wa: e.target.value })}
                    />
                  </label>
                  <label className="form-label">
                    Nome
                    <input
                      className="login-input"
                      placeholder={known?.name || "nome no WhatsApp"}
                      value={draft.name}
                      onChange={(e) => setDraft({ name: e.target.value })}
                    />
                  </label>
                </div>
                {known && <span className="field-hint">Já arrematou antes: {known.name}. Deixe o nome em branco para usar esse.</span>}
                <div className="live-row">
                  <button type="button" className="btn-primary live-gold" onClick={encerrarComArremate} disabled={pending}>
                    Encerrar com arremate
                  </button>
                  <button type="button" className="btn-ghost" onClick={encerrarSemLance} disabled={pending}>
                    Encerrar sem lance
                  </button>
                </div>
              </>
            )}

            {closed && (
              <div className="live-row">
                {confirm && winner && (
                  <>
                    <button type="button" className="btn-primary" onClick={() => say(confirm)}>
                      Copiar confirmação
                    </button>
                    <a
                      className="btn-primary live-wa"
                      href={`https://wa.me/${winner.whatsapp}?text=${encodeURIComponent(confirm)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Enviar confirmação no WhatsApp
                    </a>
                  </>
                )}
                <button type="button" className="collection-option-remove" onClick={corrigir} disabled={pending}>
                  {armed === "corrigir" ? "Clique de novo para desfazer" : "Corrigir resultado"}
                </button>
              </div>
            )}
            {error && <div className="login-error">{error}</div>}
          </div>
        </div>

        <div className="live-msg">
          <div className="live-row">
            <span className="live-kicker">Mensagem do momento</span>
            <div className="modal-header-spacer" />
            <button type="button" className="btn-primary" onClick={() => (msg ? say(msg) : flash("Use um dos botões do painel para gerar a mensagem."))}>
              Copiar mensagem
            </button>
          </div>
          <pre className="wa-text">{msg || "Nada copiado ainda."}</pre>
        </div>

        <div className="live-row live-nav">
          <button type="button" className="btn-ghost" onClick={() => irPara(idx - 1)} disabled={idx === 0}>
            ← Lote anterior
          </button>
          <div className="modal-header-spacer" />
          <button type="button" className="btn-ghost" onClick={() => irPara(idx + 1)} disabled={idx === total - 1}>
            Próximo lote →
          </button>
        </div>
      </section>

      <section className="admin-section">
        <div className="collections-head">
          <h2 className="admin-section-title">Lotes</h2>
          <span className="adm-updated">
            {doneCount} de {total} encerrados · arrematado {brl(soldTotal)}
          </span>
        </div>
        <ol className="live-strip">
          {lots.map((l, i) => (
            <li key={l.id}>
              <button
                type="button"
                className={`live-chip is-${l.status}${l.id === lot.id ? " is-current" : ""}`}
                title={`${l.name} · ${LOT_STATUS_LABEL[l.status]}`}
                onClick={() => irPara(i)}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
        {allDone && (
          <div className="live-msg">
            <div className="live-row">
              <span className="live-kicker">Todos os lotes encerrados</span>
              <div className="modal-header-spacer" />
              <button type="button" className="btn-primary" onClick={() => say(finalText(auction, lots, byId))}>
                Copiar mensagem de encerramento
              </button>
              {auction.status !== "encerrado" && (
                <button type="button" className="btn-ghost" onClick={encerrarLeilao} disabled={pending}>
                  {armed === "fim" ? "Clique de novo para encerrar" : "Encerrar leilão"}
                </button>
              )}
            </div>
          </div>
        )}
        {auction.status !== "encerrado" && (
          <div className="live-row">
            <button type="button" className="collection-option-remove" onClick={reiniciar} disabled={pending}>
              {armed === "reiniciar" ? "Clique de novo para reiniciar" : "Reiniciar leilão"}
            </button>
            <span className="field-hint">Reiniciar apaga os resultados deste leilão e volta ao lote 1.</span>
          </div>
        )}
      </section>

      {toast && (
        <div className="live-toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
