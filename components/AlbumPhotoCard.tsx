"use client";

import Image from "next/image";
import { POSITION_LABELS, cellText, displayCode, itemPosition, stickerName } from "@/lib/album";
import { useCatalog } from "@/lib/CatalogContext";
import { stickerImage } from "@/lib/stickerImages";
import type { ModoClique } from "@/lib/types";

interface AlbumPhotoCardProps {
  code: string;
  qty: number;
  modo: ModoClique;
  onBump: (code: string, delta: number) => void;
  readOnly?: boolean;
}

export default function AlbumPhotoCard({ code, qty, modo, onBump, readOnly }: AlbumPhotoCardProps) {
  const { owned } = useCatalog();
  const nome = stickerName(code);
  const pos = itemPosition(code);
  const img = stickerImage(code, "thumb");
  const stateClass = qty === 0 ? "album-card-empty" : qty === 1 ? "album-card-full" : "album-card-dup";
  const repetidas = qty - 1;
  const status =
    qty === 0 ? "Falta" : qty === 1 ? owned.cell[0].toUpperCase() + owned.cell.slice(1) : `+${repetidas} repetida${repetidas === 1 ? "" : "s"}`;

  const id = nome ? `${displayCode(code)} ${nome}` : displayCode(code);
  const acao = modo === "add" ? "somar" : "tirar";
  const title = readOnly ? `${id} — ${status}` : `${id} — ${status} · toque para ${acao}, clique direito inverte`;

  const media = img ? (
    <Image src={img} alt={id} width={240} height={336} unoptimized loading="lazy" />
  ) : (
    <span className="shop-card-placeholder" data-pos={pos ?? undefined}>
      {cellText(code)}
      {/* Sem foto (Adrenalyn): nome e posição no lugar da imagem. */}
      {nome && !img && cellText(code) !== nome && <small className="placeholder-name">{nome}</small>}
      {pos && !img && <small className="placeholder-pos">{POSITION_LABELS[pos]}</small>}
    </span>
  );

  return (
    <div className={`shop-card album-card ${stateClass}`}>
      {readOnly ? (
        <div className="shop-card-img album-card-img-static" title={title}>
          {media}
          {qty > 1 && <span className="sticker-badge shop-card-badge">+{repetidas}</span>}
        </div>
      ) : (
        <button
          type="button"
          className="shop-card-img album-card-img"
          title={title}
          aria-label={title}
          onClick={() => onBump(code, modo === "add" ? 1 : -1)}
          onContextMenu={(e) => {
            e.preventDefault();
            onBump(code, modo === "add" ? -1 : 1);
          }}
        >
          {media}
          {qty > 1 && <span className="sticker-badge shop-card-badge">+{repetidas}</span>}
        </button>
      )}
      <div className="shop-card-footer">
        <div className="shop-card-meta">
          <span className="shop-card-code">{nome ?? displayCode(code)}</span>
          <span className="album-card-status">{status}</span>
        </div>
        {!readOnly &&
          (qty > 0 ? (
            <div className="stepper stepper-compact">
              <button type="button" onClick={() => onBump(code, -1)} aria-label={`Tirar um ${id}`}>
                −
              </button>
              <span>{qty}</span>
              <button type="button" onClick={() => onBump(code, 1)} disabled={qty >= 99} aria-label={`Somar um ${id}`}>
                +
              </button>
            </div>
          ) : (
            <button type="button" className="shop-card-add" onClick={() => onBump(code, 1)} aria-label={`Marcar ${id}`}>
              +
            </button>
          ))}
      </div>
    </div>
  );
}
