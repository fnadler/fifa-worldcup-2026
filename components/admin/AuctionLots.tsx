"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { deleteLot, moveLot, saveLot } from "@/app/admin/leiloes/actions";
import { LOT_DETAIL_MAX, LOT_NAME_MAX, LOT_STATUS_LABEL, suggestedStartCents, type AuctionLot } from "@/lib/auctions";
import { fitImage } from "@/lib/imageResize";
import { centsToInput, formatBRL, parseBRL } from "@/lib/shop";

// Lotes do leilão, na ordem em que entram no grupo: foto, nome, descrição, estimativa e lance inicial.
// Lance inicial em branco = ponto médio da estimativa, arredondado para cima em R$ 10.

interface Draft {
  id: string | null;
  name: string;
  detail: string;
  estimateMin: string;
  estimateMax: string;
  start: string;
  imageUrl: string | null;
  file: Blob | null;
  preview: string | null;
  removeImage: boolean;
}

const EMPTY: Draft = { id: null, name: "", detail: "", estimateMin: "", estimateMax: "", start: "", imageUrl: null, file: null, preview: null, removeImage: false };

function estimate(l: AuctionLot): string | null {
  if (l.estimateMinCents === null && l.estimateMaxCents === null) return null;
  if (l.estimateMinCents !== null && l.estimateMaxCents !== null) return `${formatBRL(l.estimateMinCents)} a ${formatBRL(l.estimateMaxCents)}`;
  return formatBRL((l.estimateMinCents ?? l.estimateMaxCents)!);
}

export default function AuctionLots({ auctionId, lots }: { auctionId: string; lots: AuctionLot[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const totalStart = lots.reduce((s, l) => s + l.startCents, 0);
  const semFoto = lots.filter((l) => !l.imagePath).length;

  function abrir(l: AuctionLot | null) {
    setError(null);
    setDraft(
      l
        ? {
            ...EMPTY,
            id: l.id,
            name: l.name,
            detail: l.detail,
            estimateMin: centsToInput(l.estimateMinCents),
            estimateMax: centsToInput(l.estimateMaxCents),
            start: centsToInput(l.startCents),
            imageUrl: l.imageUrl,
          }
        : EMPTY
    );
  }

  function fechar() {
    if (draft?.preview) URL.revokeObjectURL(draft.preview);
    setDraft(null);
    setError(null);
  }

  async function escolherFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !draft) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setError("Use uma foto PNG, JPG ou WebP.");
    if (file.size > 25 * 1024 * 1024) return setError("Foto grande demais (máx. 25 MB).");
    try {
      const blob = await fitImage(file, 1600);
      if (draft.preview) URL.revokeObjectURL(draft.preview);
      setDraft({ ...draft, file: blob, preview: URL.createObjectURL(blob), removeImage: false });
      setError(null);
    } catch {
      setError("Não foi possível ler essa foto — tente outra.");
    }
  }

  function salvar(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const fd = new FormData();
    fd.set("auctionId", auctionId);
    fd.set("lotId", draft.id ?? "");
    fd.set("name", draft.name);
    fd.set("detail", draft.detail);
    fd.set("estimateMin", draft.estimateMin);
    fd.set("estimateMax", draft.estimateMax);
    fd.set("start", draft.start);
    if (draft.file) fd.set("image", new File([draft.file], "lote.jpg", { type: draft.file.type }));
    if (draft.removeImage) fd.set("removeImage", "1");
    setError(null);
    start(async () => {
      const r = await saveLot(fd);
      if (!r.ok) return setError(r.error);
      fechar();
    });
  }

  function excluir(l: AuctionLot) {
    if (confirmId !== l.id) {
      setConfirmId(l.id);
      setTimeout(() => setConfirmId((c) => (c === l.id ? null : c)), 4000);
      return;
    }
    setConfirmId(null);
    start(async () => {
      const r = await deleteLot(auctionId, l.id);
      setListError(r.ok ? null : r.error);
    });
  }

  function mover(l: AuctionLot, delta: -1 | 1) {
    start(async () => {
      const r = await moveLot(auctionId, l.id, delta);
      setListError(r.ok ? null : r.error);
    });
  }

  // Sugestão do lance inicial enquanto o campo está vazio.
  const minC = draft ? parseBRL(draft.estimateMin) : null;
  const maxC = draft ? parseBRL(draft.estimateMax) : null;
  const sugestao =
    draft && !draft.start && !Number.isNaN(minC) && !Number.isNaN(maxC) ? suggestedStartCents(minC, maxC) : null;
  const img = draft?.preview ?? (draft?.removeImage ? null : draft?.imageUrl) ?? null;

  return (
    <section className="admin-section">
      <div className="collections-head">
        <h2 className="admin-section-title">Lotes</h2>
        <button type="button" className="btn-primary" onClick={() => abrir(null)} disabled={pending}>
          + Novo lote
        </button>
      </div>
      <p className="adm-updated">
        {lots.length} {lots.length === 1 ? "lote" : "lotes"} · lances iniciais somam {formatBRL(totalStart)}
        {semFoto > 0 && ` · ${semFoto} sem foto`}
      </p>
      {listError && <div className="login-error">{listError}</div>}

      {lots.length === 0 && <div className="empty-message">Nenhum lote cadastrado ainda.</div>}

      <ol className="auction-lots">
        {lots.map((l, i) => (
          <li key={l.id} className="admin-product">
            <span className="auction-lot-n">{i + 1}</span>
            <div className="admin-product-img auction-lot-img">
              {/* eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário */}
              {l.imageUrl ? <img src={l.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">📷</span>}
            </div>
            <div className="admin-product-info">
              <strong>{l.name}</strong>
              {l.detail && <span>{l.detail}</span>}
              <span>
                Lance inicial <b>{formatBRL(l.startCents)}</b>
                {estimate(l) && ` · estimativa ${estimate(l)}`}
              </span>
              {l.status !== "aguardando" && (
                <span className={`admin-product-status${l.status === "arrematado" ? " is-on" : ""}`}>
                  {LOT_STATUS_LABEL[l.status]}
                  {l.status === "arrematado" && l.soldCents !== null && ` por ${formatBRL(l.soldCents)}`}
                </span>
              )}
            </div>
            <div className="auction-lot-actions">
              <div className="auction-lot-move">
                <button type="button" className="btn-ghost" aria-label="Subir" disabled={pending || i === 0} onClick={() => mover(l, -1)}>
                  ↑
                </button>
                <button type="button" className="btn-ghost" aria-label="Descer" disabled={pending || i === lots.length - 1} onClick={() => mover(l, 1)}>
                  ↓
                </button>
              </div>
              <button type="button" className="btn-ghost" onClick={() => abrir(l)} disabled={pending}>
                Editar
              </button>
              {l.status !== "arrematado" && (
                <button type="button" className="collection-option-remove" onClick={() => excluir(l)} disabled={pending}>
                  {confirmId === l.id ? "Confirmar" : "Excluir"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>

      {draft && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={draft.id ? "Editar lote" : "Novo lote"} onClick={() => !pending && fechar()}>
          <form className="modal-card product-form" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
            <div className="modal-header">
              <span className="modal-title">{draft.id ? "Editar lote" : "Novo lote"}</span>
              <div className="modal-header-spacer" />
              <button type="button" className="modal-close" onClick={fechar} aria-label="Fechar" disabled={pending}>
                ×
              </button>
            </div>

            <div className="product-form-image">
              <div className="admin-product-img is-large auction-lot-img">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local ou link assinado */}
                {img ? <img src={img} alt="" /> : <span aria-hidden="true">📷</span>}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={escolherFoto} />
                <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
                  {img ? "Trocar foto" : "Escolher foto"}
                </button>
                {img && (
                  <button
                    type="button"
                    className="collection-option-remove"
                    onClick={() => {
                      if (draft.preview) URL.revokeObjectURL(draft.preview);
                      setDraft({ ...draft, file: null, preview: null, removeImage: true });
                    }}
                  >
                    Tirar foto
                  </button>
                )}
                <span className="field-hint">A foto vai inteira, sem recorte. É a mesma que você copia para o grupo.</span>
              </div>
            </div>

            <label className="form-label">
              Nome do lote
              <input
                className="login-input"
                required
                maxLength={LOT_NAME_MAX}
                placeholder="Ex: Vini Jr."
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="form-label">
              O que vem no lote
              <textarea
                className="login-input product-form-desc"
                rows={3}
                maxLength={LOT_DETAIL_MAX}
                placeholder="Ex: Golden Baller + Icon (Adrenalyn XL) + figurinha do álbum"
                value={draft.detail}
                onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label className="form-label">
                Estimativa mín. (R$)
                <input className="login-input" inputMode="decimal" placeholder="60" value={draft.estimateMin} onChange={(e) => setDraft({ ...draft, estimateMin: e.target.value })} />
              </label>
              <label className="form-label">
                Estimativa máx. (R$)
                <input className="login-input" inputMode="decimal" placeholder="100" value={draft.estimateMax} onChange={(e) => setDraft({ ...draft, estimateMax: e.target.value })} />
              </label>
              <label className="form-label">
                Lance inicial (R$)
                <input
                  className="login-input"
                  inputMode="decimal"
                  placeholder={sugestao !== null ? centsToInput(sugestao) : "80"}
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </label>
            </div>
            {sugestao !== null && <span className="field-hint">Em branco, o lance inicial fica em {formatBRL(sugestao)} (ponto médio da estimativa).</span>}

            {error && <div className="login-error">{error}</div>}

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={fechar} disabled={pending}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Salvando…" : draft.id ? "Salvar lote" : "Adicionar lote"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
