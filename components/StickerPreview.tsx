"use client";

import Image from "next/image";
import { useEffect } from "react";
import { cellText } from "@/lib/album";
import { describeSticker, formatBRL } from "@/lib/shop";
import { stickerImage } from "@/lib/stickerImages";

interface StickerPreviewProps {
  code: string;
  price: number | null;
  available: number;
  inCart: number;
  onChange: (code: string, delta: number) => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}

export default function StickerPreview({
  code,
  price,
  available,
  inCart,
  onChange,
  onPrev,
  onNext,
  onClose,
}: StickerPreviewProps) {
  const vendavel = price !== null && available > 0;
  const img = stickerImage(code, "large");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Figurinha ${code}`}>
      <div className="modal-card preview-card" onClick={(e) => e.stopPropagation()}>
        <div className="preview-media">
          {onPrev && (
            <button type="button" className="preview-nav preview-prev" onClick={onPrev} aria-label="Anterior">
              ‹
            </button>
          )}
          {img ? (
            <Image key={code} src={img} alt={code} width={720} height={1008} unoptimized priority />
          ) : (
            <span className="shop-card-placeholder preview-placeholder">{cellText(code)}</span>
          )}
          {onNext && (
            <button type="button" className="preview-nav preview-next" onClick={onNext} aria-label="Próxima">
              ›
            </button>
          )}
          <button type="button" className="modal-close preview-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="preview-info">
          <div className="preview-title">
            <span className="cart-line-code">{code}</span>
            <span className="cart-line-meta">{describeSticker(code)}</span>
          </div>
          <div className="preview-buy">
            {vendavel ? (
              <>
                <div className="preview-price">
                  <span className="cart-total-value">{formatBRL(price)}</span>
                  <span className="cart-line-meta">
                    {available} disponíve{available === 1 ? "l" : "is"}
                  </span>
                </div>
                {inCart > 0 ? (
                  <div className="stepper">
                    <button type="button" onClick={() => onChange(code, -1)} aria-label="Diminuir">
                      −
                    </button>
                    <span>{inCart}</span>
                    <button type="button" onClick={() => onChange(code, 1)} disabled={inCart >= available} aria-label="Aumentar">
                      +
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => onChange(code, 1)}>
                    Adicionar ao carrinho
                  </button>
                )}
              </>
            ) : (
              <span className="cart-warning">Indisponível no momento</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
