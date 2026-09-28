"use client";

import Image from "next/image";
import { useEffect } from "react";

// Logo da loja ampliado (clique no ícone do cabeçalho da vitrine).
export default function LogoPreview({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Logo de ${name}`}>
      <div className="logo-preview" onClick={(e) => e.stopPropagation()}>
        <Image src={src} alt={`Logo de ${name}`} width={640} height={640} unoptimized priority />
        <span className="logo-preview-name">{name}</span>
        <button type="button" className="modal-close preview-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>
    </div>
  );
}
