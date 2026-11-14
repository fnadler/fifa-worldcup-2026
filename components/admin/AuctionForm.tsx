"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { deleteAuction, saveAuction, type AuctionInput } from "@/app/admin/leiloes/actions";
import {
  AUCTION_ANNOUNCEMENT_MAX,
  AUCTION_PIX_MAX,
  AUCTION_SHIPPING_MAX,
  AUCTION_STATUS_LABEL,
  AUCTION_TITLE_MAX,
  inputsFromStartsAt,
  type Auction,
  type AuctionStatus,
} from "@/lib/auctions";
import { centsToInput } from "@/lib/shop";

// Dados do leilão: nome, data e hora, regras (tempo por lote, prorrogação, incremento), Pix, frete
// e o texto de divulgação. As mensagens do grupo (fase 2) saem destes campos.

export default function AuctionForm({ auction, defaults }: { auction: Auction | null; defaults?: Partial<Auction> }) {
  const router = useRouter();
  const base = auction ?? defaults ?? {};
  const when = auction ? inputsFromStartsAt(auction.startsAt) : { date: "", time: "18:30" };
  const [v, setV] = useState<AuctionInput>({
    title: auction?.title ?? "",
    date: when.date,
    time: when.time,
    status: auction?.status ?? "rascunho",
    lotMinutes: String(base.lotMinutes ?? 3),
    extensionMinutes: String(base.extensionMinutes ?? 1),
    minIncrement: centsToInput(base.minIncrementCents ?? 1000),
    pixKey: base.pixKey ?? "",
    pixDeadlineHours: String(base.pixDeadlineHours ?? 24),
    shippingNote: base.shippingNote ?? "",
    announcement: auction?.announcement ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k: keyof AuctionInput) => (e: { target: { value: string } }) => {
    setV({ ...v, [k]: e.target.value });
    setSaved(false);
  };

  function salvar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveAuction(auction?.id ?? null, v);
      if (!r.ok) return setError(r.error);
      if (!auction) router.push(`/admin/leiloes/${r.id}`);
      else setSaved(true);
    });
  }

  function excluir() {
    if (!auction) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    start(async () => {
      const r = await deleteAuction(auction.id);
      if (!r.ok) return setError(r.error);
      router.push("/admin/leiloes");
    });
  }

  return (
    <form className="auction-form" onSubmit={salvar}>
      <div className="form-row">
        <label className="form-label">
          Nome do leilão
          <input className="login-input" required maxLength={AUCTION_TITLE_MAX} placeholder="Ex: Leilão GN Coleciona #2" value={v.title} onChange={set("title")} />
        </label>
        <label className="form-label form-narrow">
          Data
          <input className="login-input" type="date" required value={v.date} onChange={set("date")} />
        </label>
        <label className="form-label form-narrow">
          Horário
          <input className="login-input" type="time" required value={v.time} onChange={set("time")} />
        </label>
        <label className="form-label form-narrow">
          Situação
          <select className="login-input" value={v.status} onChange={set("status")}>
            {(Object.keys(AUCTION_STATUS_LABEL) as AuctionStatus[]).map((s) => (
              <option key={s} value={s}>
                {AUCTION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label className="form-label form-narrow">
          Minutos por lote
          <input className="login-input" inputMode="numeric" required value={v.lotMinutes} onChange={set("lotMinutes")} />
        </label>
        <label className="form-label form-narrow">
          Prorrogação (min)
          <input className="login-input" inputMode="numeric" required value={v.extensionMinutes} onChange={set("extensionMinutes")} />
        </label>
        <label className="form-label form-narrow">
          Incremento mínimo (R$)
          <input className="login-input" inputMode="decimal" required value={v.minIncrement} onChange={set("minIncrement")} />
        </label>
        <label className="form-label form-narrow">
          Prazo do Pix (horas)
          <input className="login-input" inputMode="numeric" required value={v.pixDeadlineHours} onChange={set("pixDeadlineHours")} />
        </label>
      </div>

      <div className="form-row">
        <label className="form-label">
          Chave Pix
          <input className="login-input" maxLength={AUCTION_PIX_MAX} placeholder="Ex: CPF 000.000.000-00 (Nome)" value={v.pixKey} onChange={set("pixKey")} />
        </label>
        <label className="form-label">
          Frete
          <input
            className="login-input"
            maxLength={AUCTION_SHIPPING_MAX}
            placeholder="Ex: Correios ou retirada combinada; frete por conta de quem arrematou"
            value={v.shippingNote}
            onChange={set("shippingNote")}
          />
        </label>
      </div>

      <label className="form-label">
        Texto de divulgação
        <textarea
          className="login-input auction-announcement"
          rows={6}
          maxLength={AUCTION_ANNOUNCEMENT_MAX}
          placeholder="O texto que você posta para chamar a comunidade. Use *negrito* como no WhatsApp."
          value={v.announcement}
          onChange={set("announcement")}
        />
      </label>

      {error && <div className="login-error">{error}</div>}

      <div className="auction-form-actions">
        {auction && auction.status !== "encerrado" && (
          <button type="button" className="collection-option-remove" onClick={excluir} disabled={pending}>
            {confirmDelete ? "Clique de novo para excluir" : "Excluir leilão"}
          </button>
        )}
        <div className="modal-header-spacer" />
        {saved && <span className="auction-saved">Salvo ✓</span>}
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : auction ? "Salvar alterações" : "Criar leilão"}
        </button>
      </div>
    </form>
  );
}
