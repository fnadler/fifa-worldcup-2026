"use client";

import Image from "next/image";
import { stickerLabel, stickerName } from "@/lib/album";
import { formatBRL } from "@/lib/shop";
import { stickerImage } from "@/lib/stickerImages";

import type { ViewMode } from "@/lib/types";

export type ShopView = ViewMode;

interface ShopCellProps {
  code: string;
  price: number | null;
  available: number;
  inCart: number;
  view: ShopView;
  onChange: (code: string, delta: number) => void;
  onPreview: (code: string) => void;
}

export default function ShopCell({ code, price, available, inCart, view, onChange, onPreview }: ShopCellProps) {
  const vendavel = price !== null && available > 0;
  const stateClass = !vendavel ? "shop-cell-off" : inCart > 0 ? "shop-cell-in-cart" : "shop-cell-on";
  const esgotouNoCarrinho = inCart >= available;

  const nome = stickerName(code);
  const id = nome ? `${code} ${nome}` : code;
  const title = !vendavel
    ? `${id} — indisponível`
    : `${id} — ${formatBRL(price)} · ${available} disponíve${available === 1 ? "l" : "is"}` +
      (inCart ? ` · ${inCart} no carrinho` : "");

  if (view === "grid") {
    const gridTitle = vendavel ? `${title} · clique para adicionar, clique direito remove` : title;
    return (
      <button
        type="button"
        title={gridTitle}
        aria-label={gridTitle}
        className={`shop-cell ${stateClass}`}
        disabled={!vendavel}
        onClick={() => !esgotouNoCarrinho && onChange(code, 1)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (inCart > 0) onChange(code, -1);
        }}
      >
        <span className={nome ? "sticker-name" : "sticker-num"}>{nome ?? stickerLabel(code)}</span>
        {vendavel && <span className="shop-cell-price">{formatBRL(price)}</span>}
        {vendavel && !inCart && <span className="shop-cell-stock">{available} disp.</span>}
        {inCart > 0 && <span className="sticker-badge">{inCart}</span>}
      </button>
    );
  }

  const img = stickerImage(code, "thumb");

  return (
    <div className={`shop-card ${vendavel ? "" : "is-off"} ${inCart > 0 ? "is-in-cart" : ""}`}>
      <button type="button" className="shop-card-img" onClick={() => onPreview(code)} aria-label={`Ampliar ${title}`} title={title}>
        {img ? (
          <Image src={img} alt={code} width={240} height={336} unoptimized loading="lazy" />
        ) : (
          <span className="shop-card-placeholder">{nome ?? stickerLabel(code)}</span>
        )}
        {inCart > 0 && <span className="sticker-badge shop-card-badge">{inCart}</span>}
      </button>
      <div className="shop-card-footer">
        <div className="shop-card-meta">
          <span className="shop-card-code">{code}</span>
          {nome && <span className="shop-card-name">{nome}</span>}
          <span className="shop-card-price">{vendavel ? formatBRL(price) : "Indisponível"}</span>
        </div>
        {vendavel &&
          (inCart > 0 ? (
            <div className="stepper stepper-compact">
              <button type="button" onClick={() => onChange(code, -1)} aria-label={`Remover um ${code}`}>
                −
              </button>
              <span>{inCart}</span>
              <button type="button" onClick={() => onChange(code, 1)} disabled={esgotouNoCarrinho} aria-label={`Adicionar um ${code}`}>
                +
              </button>
            </div>
          ) : (
            <button type="button" className="shop-card-add" onClick={() => onChange(code, 1)} aria-label={`Adicionar ${code} ao carrinho`}>
              +
            </button>
          ))}
      </div>
    </div>
  );
}
