"use client";

import { stickerLabel } from "@/lib/album";
import type { ModoClique } from "@/lib/types";

interface StickerCellProps {
  code: string;
  qty: number;
  modo: ModoClique;
  onBump: (code: string, delta: number) => void;
  readOnly?: boolean;
}

export default function StickerCell({ code, qty, modo, onBump, readOnly }: StickerCellProps) {
  const stateClass = qty === 0 ? "cell-empty" : qty === 1 ? "cell-full" : "cell-dup";
  const label = stickerLabel(code);

  const posse =
    qty === 0
      ? "não tenho"
      : qty === 1
        ? "tenho 1 (colada)"
        : `tenho ${qty} (${qty - 1} repetida${qty - 2 ? "s" : ""})`;
  const acao = modo === "add" ? "somar" : "tirar";
  const title = readOnly ? `${code} — ${posse}` : `${code} — ${posse} · clique para ${acao}, clique direito inverte`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`sticker-cell ${stateClass} ${readOnly ? "cell-readonly" : ""}`}
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
      <span className="sticker-num">{label}</span>
      {qty > 1 && <span className="sticker-badge">+{qty - 1}</span>}
    </button>
  );
}
