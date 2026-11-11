"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCatalog } from "@/lib/CatalogContext";
import type { MenuSection } from "@/lib/catalog";
import type { BulkMode } from "@/lib/sync";
import type { AlbumBlock, Qtd } from "@/lib/types";

// Marcação em lote: escolhe seleções/blocos, a quantidade e como aplicar ("Definir" ou "Somar"), vê a
// prévia e aplica. A conta de verdade é feita no banco (collection_bulk_apply) — a prévia aqui usa o
// mesmo cálculo sobre o que está na tela.

interface BulkMarkModalProps {
  qtd: Qtd;
  /** Blocos já marcados ao abrir (atalho "Marcar bloco" no cabeçalho de cada seleção). */
  initialBlockIds?: string[];
  /** true = aplicado (o modal fecha). */
  onApply: (codes: string[], mode: BulkMode, qty: number, keepHigher: boolean) => Promise<boolean>;
  onClose: () => void;
}

const MAX = 99;

export function bulkNewQty(cur: number, mode: BulkMode, qty: number, keepHigher: boolean): number {
  if (mode === "add") return Math.min(MAX, cur + qty);
  return keepHigher ? Math.max(cur, qty) : qty;
}

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios;
}

export default function BulkMarkModal({ qtd, initialBlockIds, onApply, onClose }: BulkMarkModalProps) {
  const catalog = useCatalog();
  const fem = catalog.itemSingular === "figurinha";
  const item = catalog.itemSingular;
  const itens = catalog.itemPlural;
  const as = fem ? "as" : "os";

  // Seções do menu "Grupos" + qualquer bloco que não esteja nelas (por segurança).
  const sections = useMemo<MenuSection[]>(() => {
    const listed = new Set(catalog.menuSections.flatMap((s) => s.blocks.map((b) => b.id)));
    const rest = catalog.blocks.filter((b) => !listed.has(b.id));
    return rest.length ? [...catalog.menuSections, { title: "Outros", variant: "team", blocks: rest }] : catalog.menuSections;
  }, [catalog]);

  const albumBlocks = useMemo(() => catalog.blocks.filter((b) => catalog.countsToward(b)), [catalog]);
  const extrasTitles = useMemo(
    () => sections.filter((s) => s.blocks.every((b) => !catalog.countsToward(b))).map((s) => s.title),
    [sections, catalog]
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialBlockIds ?? []));
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(sections.filter((s) => s.blocks.some((b) => initialBlockIds?.includes(b.id))).map((s) => s.title))
  );
  const [mode, setMode] = useState<BulkMode>("set");
  const [qtyText, setQtyText] = useState("2");
  const [keepHigher, setKeepHigher] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);

  const minQty = mode === "add" ? 1 : 0;
  const parsed = Number.parseInt(qtyText, 10);
  const qty = Number.isFinite(parsed) ? Math.max(minQty, Math.min(MAX, parsed)) : null;
  const keep = mode === "set" && keepHigher && (qty ?? 0) > 0;

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("keydown", onKey);
    };
  }, [busy, onClose]);

  const codes = useMemo(
    () => catalog.blocks.filter((b) => selected.has(b.id)).flatMap((b) => b.codes),
    [catalog, selected]
  );

  const preview = useMemo(() => {
    const p = { total: codes.length, changed: 0, entram: 0, sobem: 0, descem: 0, saem: 0, repAntes: 0, repDepois: 0 };
    if (qty === null) return p;
    for (const code of codes) {
      const cur = qtd[code] ?? 0;
      const next = bulkNewQty(cur, mode, qty, keep);
      p.repAntes += Math.max(0, cur - 1);
      p.repDepois += Math.max(0, next - 1);
      if (next === cur) continue;
      p.changed++;
      if (cur === 0) p.entram++;
      else if (next === 0) p.saem++;
      else if (next > cur) p.sobem++;
      else p.descem++;
    }
    return p;
  }, [codes, qtd, mode, qty, keep]);

  function toggleBlocks(blocks: AlbumBlock[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      blocks.forEach((b) => (on ? next.add(b.id) : next.delete(b.id)));
      return next;
    });
  }

  function toggleOpen(title: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  function step(delta: number) {
    const base = qty ?? minQty;
    setQtyText(String(Math.max(minQty, Math.min(MAX, base + delta))));
  }

  function trocarModo(m: BulkMode) {
    setMode(m);
    if (m === "add" && (qty ?? 0) < 1) setQtyText("1");
  }

  async function aplicar() {
    if (busy || qty === null || !preview.changed || !online) return;
    setBusy(true);
    const ok = await onApply(codes, mode, qty, keep);
    setBusy(false);
    if (ok) onClose();
  }

  const allAlbum = albumBlocks.length > 0 && albumBlocks.every((b) => selected.has(b.id));
  const someAlbum = albumBlocks.some((b) => selected.has(b.id));

  return (
    <div className="modal-overlay bulk-overlay" onClick={busy ? undefined : onClose} role="dialog" aria-modal="true" aria-label="Marcar em lote">
      <div className="modal-card bulk-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header bulk-header">
          <span className="modal-title">Marcar em lote</span>
          <div className="modal-header-spacer" />
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="bulk-body">
          <section className="bulk-step">
            <h3 className="bulk-step-title">
              <span className="bulk-step-num">1</span>O que marcar
            </h3>

            <label className="bulk-check bulk-check-all">
              <Checkbox checked={allAlbum} indeterminate={!allAlbum && someAlbum} onChange={(on) => toggleBlocks(albumBlocks, on)} />
              <span className="bulk-check-label">
                Coleção inteira
                <small>
                  {albumBlocks.reduce((s, b) => s + b.codes.length, 0)} {itens}
                  {extrasTitles.length > 0 && ` · ${extrasTitles.join(", ")} fora — marque abaixo se quiser`}
                </small>
              </span>
            </label>

            <ul className="bulk-sections">
              {sections.map((s) => {
                const on = s.blocks.filter((b) => selected.has(b.id)).length;
                const isOpen = open.has(s.title) || s.blocks.length === 1;
                return (
                  <li key={s.title} className="bulk-section">
                    <div className="bulk-section-row">
                      <label className="bulk-check">
                        <Checkbox
                          checked={on === s.blocks.length}
                          indeterminate={on > 0 && on < s.blocks.length}
                          onChange={(v) => toggleBlocks(s.blocks, v)}
                        />
                        <span className="bulk-check-label">
                          {s.title}
                          <small>
                            {s.blocks.length > 1 ? `${s.blocks.length} blocos · ` : ""}
                            {s.blocks.reduce((n, b) => n + b.codes.length, 0)} {itens}
                          </small>
                        </span>
                      </label>
                      {s.blocks.length > 1 && (
                        <button
                          type="button"
                          className="bulk-expand"
                          onClick={() => toggleOpen(s.title)}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? "Esconder" : "Mostrar"} blocos de ${s.title}`}
                        >
                          {on > 0 && on < s.blocks.length ? `${on}/${s.blocks.length}` : ""}
                          <span className={`bulk-chevron ${isOpen ? "is-open" : ""}`}>›</span>
                        </button>
                      )}
                    </div>
                    {isOpen && s.blocks.length > 1 && (
                      <ul className="bulk-blocks">
                        {s.blocks.map((b) => {
                          const code = catalog.menuCode(b);
                          return (
                            <li key={b.id}>
                              <label className="bulk-check">
                                <Checkbox checked={selected.has(b.id)} onChange={(v) => toggleBlocks([b], v)} />
                                <span className="bulk-check-label">
                                  {catalog.menuLabel(b)}
                                  {code && <span className="bulk-block-code">{code}</span>}
                                  <small>{b.codes.length}</small>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="bulk-step">
            <h3 className="bulk-step-title">
              <span className="bulk-step-num">2</span>Quantas
            </h3>

            <div className="segmented bulk-mode">
              <button type="button" className={`chip ${mode === "set" ? "active" : ""}`} onClick={() => trocarModo("set")}>
                Definir quantidade
              </button>
              <button type="button" className={`chip ${mode === "add" ? "active" : ""}`} onClick={() => trocarModo("add")}>
                Somar
              </button>
            </div>
            <p className="bulk-mode-hint">
              {mode === "set"
                ? `Cada ${item} fica com o total que você digitar.`
                : `Soma ao que você já marcou — por exemplo, quando chega mais um álbum completo.`}
            </p>

            <div className="bulk-qty-row">
              <div className="stepper bulk-stepper">
                <button type="button" onClick={() => step(-1)} disabled={(qty ?? minQty) <= minQty} aria-label="Diminuir">
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={minQty}
                  max={MAX}
                  value={qtyText}
                  onChange={(e) => setQtyText(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  onBlur={() => qty !== null && setQtyText(String(qty))}
                  aria-label={mode === "set" ? "Total de cada uma" : "Quantas somar em cada uma"}
                />
                <button type="button" onClick={() => step(1)} disabled={(qty ?? 0) >= MAX} aria-label="Aumentar">
                  +
                </button>
              </div>
              <QtyExplainer mode={mode} qty={qty} item={item} itens={itens} fem={fem} />
            </div>

            {mode === "set" && (qty ?? 0) > 0 && (
              <label className="bulk-check bulk-keep">
                <Checkbox checked={keepHigher} onChange={setKeepHigher} />
                <span className="bulk-check-label">
                  Não diminuir {as} que já têm mais de {qty}
                </span>
              </label>
            )}
          </section>

          <section className="bulk-step bulk-preview" aria-live="polite">
            <h3 className="bulk-step-title">
              <span className="bulk-step-num">3</span>Prévia
            </h3>
            {!codes.length ? (
              <p className="bulk-preview-empty">Escolha pelo menos uma seleção ou bloco acima.</p>
            ) : qty === null ? (
              <p className="bulk-preview-empty">Digite a quantidade.</p>
            ) : (
              <>
                <p className="bulk-preview-main">
                  {preview.changed
                    ? `Vai alterar ${preview.changed} de ${preview.total} ${itens}.`
                    : `Nada muda: ${as} ${preview.total} ${itens} já estão assim.`}
                </p>
                {preview.changed > 0 && (
                  <ul className="bulk-preview-list">
                    {preview.entram > 0 && (
                      <li>
                        {preview.entram} {plural(preview.entram, "que faltava entra", "que faltavam entram")} na coleção
                      </li>
                    )}
                    {preview.sobem > 0 && (
                      <li>
                        {preview.sobem} {plural(preview.sobem, "que já tinha ganha mais repetidas", "que já tinham ganham mais repetidas")}
                      </li>
                    )}
                    {preview.descem > 0 && (
                      <li className="is-warn">
                        {preview.descem} {plural(preview.descem, "fica com menos do que tem hoje", "ficam com menos do que têm hoje")}
                      </li>
                    )}
                    {preview.saem > 0 && (
                      <li className="is-warn">
                        {preview.saem} {plural(preview.saem, "volta", "voltam")} para “falta”
                      </li>
                    )}
                    {preview.total - preview.changed > 0 && <li className="is-muted">{preview.total - preview.changed} não mudam</li>}
                    <li>
                      Repetidas {fem ? "destas" : "destes"}: <strong>{preview.repAntes}</strong> → <strong>{preview.repDepois}</strong>
                    </li>
                  </ul>
                )}
              </>
            )}
          </section>
        </div>

        <div className="bulk-footer">
          {!online && <span className="bulk-offline">Sem internet — a marcação em lote precisa de conexão.</span>}
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={aplicar}
            disabled={busy || !online || qty === null || preview.changed === 0}
          >
            {busy ? "Aplicando…" : preview.changed ? `Aplicar em ${preview.changed}` : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Explica o número: 1 vai para a coleção, o resto é repetida (estoque para trocar ou vender).
function QtyExplainer({ mode, qty, item, itens, fem }: { mode: BulkMode; qty: number | null; item: string; itens: string; fem: boolean }) {
  if (qty === null) return <div className="bulk-explain" />;
  const rep = (n: number) => `${n} repetida${n === 1 ? "" : "s"}`;

  if (mode === "set") {
    if (qty === 0)
      return (
        <div className="bulk-explain is-warn">
          <strong>0 tira a marcação</strong>: {fem ? "as" : "os"} {itens} escolhid{fem ? "a" : "o"}s voltam para “falta”.
        </div>
      );
    return (
      <div className="bulk-explain">
        <div className="bulk-split">
          <span className="bulk-pill bulk-pill-own">1 na coleção</span>
          {qty > 1 && <span className="bulk-pill bulk-pill-rep">+ {rep(qty - 1)}</span>}
        </div>
        <small>
          {qty === 1
            ? `Total 1: só para completar a coleção, sem repetidas.`
            : `Total ${qty}: 1 fica na coleção e ${qty - 1} ${qty - 1 === 1 ? "é repetida" : "são repetidas"} — o seu estoque para trocar ou vender na loja.`}
        </small>
      </div>
    );
  }

  return (
    <div className="bulk-explain">
      <div className="bulk-split">
        <span className="bulk-pill bulk-pill-add">+{qty} em cada</span>
      </div>
      <small>
        {qty === 1
          ? `Onde falta, ${fem ? "a" : "o"} ${item} entra na coleção; onde já tem, vira mais 1 repetida.`
          : `Onde falta: 1 entra na coleção e ${rep(qty - 1)}. Onde já tem: +${qty} repetidas para trocar ou vender.`}
      </small>
    </div>
  );
}

function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="bulk-checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}
