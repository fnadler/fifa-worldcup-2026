"use client";

import { POSITION_LABELS, cellText, displayCode, hasCellName, itemPosition, stickerName } from "@/lib/album";
import { useCatalog } from "@/lib/CatalogContext";
import type { ModoClique } from "@/lib/types";

interface StickerCellProps {
  code: string;
  qty: number;
  modo: ModoClique;
  onBump: (code: string, delta: number) => void;
  readOnly?: boolean;
}

export default function StickerCell({ code, qty, modo, onBump, readOnly }: StickerCellProps) {
  const owned = useCatalog().owned.cell;
  const stateClass = qty === 0 ? "cell-empty" : qty === 1 ? "cell-full" : "cell-dup";

  const posse =
    qty === 0
      ? "não tenho"
      : qty === 1
        ? `tenho 1${owned === "tenho" ? "" : ` (${owned})`}`
        : `tenho ${qty} (${qty - 1} repetida${qty - 2 ? "s" : ""})`;
  const acao = modo === "add" ? "somar" : "tirar";
  const nome = stickerName(code);
  const pos = itemPosition(code);
  const id = `${displayCode(code)}${nome ? ` ${nome}` : ""}${pos ? ` · ${POSITION_LABELS[pos]}` : ""}`;
  const title = readOnly ? `${id} — ${posse}` : `${id} — ${posse} · clique para ${acao}, clique direito inverte`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`sticker-cell ${stateClass} ${readOnly ? "cell-readonly" : ""}`}
      data-pos={pos ?? undefined}
      disabled={readOnly}
      onClick={readOnly ? undefined : () => onBump(code, modo === "add" ? 1 : -1)}
      onContextMenu={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              onBump(code, modo === "add" ? -1 : 1);
            }
      }
    >
      <span className={hasCellName(code) ? "sticker-name" : "sticker-num"}>{cellText(code)}</span>
      {qty > 1 && <span className="sticker-badge">+{qty - 1}</span>}
    </button>
  );
}
