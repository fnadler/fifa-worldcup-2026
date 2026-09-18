"use client";

import { useState } from "react";

interface TrocasModalProps {
  lista: string;
  totRepetidas: number;
  onClose: () => void;
}

export default function TrocasModal({ lista, totRepetidas, onClose }: TrocasModalProps) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(lista);
    } catch {
      // clipboard API unavailable — the text is still visible in the modal to copy manually
    }
    setCopiado(true);
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Minhas repetidas"
    >
      <div className="modal-card trocas-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Minhas repetidas</span>
          <span className="modal-count">{totRepetidas} figurinhas</span>
          <div className="modal-header-spacer" />
          <button type="button" className="btn-primary" onClick={copiar}>
            {copiado ? "Copiado!" : "Copiar lista"}
          </button>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="trocas-body">{lista}</div>
      </div>
    </div>
  );
}
