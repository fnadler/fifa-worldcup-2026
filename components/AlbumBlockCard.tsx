"use client";

import { anchorId } from "@/lib/album";
import type { ModoClique, VisibleBlock } from "@/lib/types";
import StickerCell from "./StickerCell";

interface AlbumBlockCardProps {
  vb: VisibleBlock;
  modo?: ModoClique;
  onBump?: (code: string, delta: number) => void;
  readOnly?: boolean;
}

export default function AlbumBlockCard({ vb, modo = "add", onBump, readOnly }: AlbumBlockCardProps) {
  const { block, tag, codigoBase, coladas, repetidas, pct, stickers } = vb;
  const isSpecial = block.tipo !== "TEAM";

  return (
    <div id={anchorId(block)} className="block-card">
      <div className="block-header">
        <span className={`block-tag ${isSpecial ? "block-tag-special" : ""}`}>{tag}</span>
        <span className="block-name">{block.nome}</span>
        <span className="block-code-range">{codigoBase}</span>
        <div className="block-header-spacer" />
        <span className="block-summary-coladas">
          {coladas}/{block.codes.length} coladas
        </span>
        <span className="block-summary-repetidas">{repetidas} repetidas</span>
        <div className="progress-track">
          <div
            className={`progress-fill ${pct === 100 ? "is-full" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="cell-grid">
        {stickers.map((s) => (
          <StickerCell
            key={s.code}
            code={s.code}
            qty={s.qty}
            modo={modo}
            onBump={onBump ?? (() => {})}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}
