"use client";

import { useState } from "react";

// Listas em texto para mandar no WhatsApp: repetidas (para troca/venda) ou faltantes.

type Aba = "rep" | "miss";

interface ExportModalProps {
  repetidas: string;
  faltantes: string;
  onClose: () => void;
}

export default function ExportModal({ repetidas, faltantes, onClose }: ExportModalProps) {
  const [aba, setAba] = useState<Aba>("rep");
  const [copiado, setCopiado] = useState(false);
  const lista = aba === "rep" ? repetidas : faltantes;

  function trocar(nova: Aba) {
    setAba(nova);
    setCopiado(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(lista);
    } catch {
      // clipboard API unavailable — the text is still visible in the modal to copy manually
    }
    setCopiado(true);
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Exportar lista">
      <div className="modal-card trocas-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Exportar</span>
          <div className="segmented">
            <button type="button" className={`chip ${aba === "rep" ? "active" : ""}`} onClick={() => trocar("rep")}>
              Repetidas
            </button>
            <button type="button" className={`chip ${aba === "miss" ? "active" : ""}`} onClick={() => trocar("miss")}>
              Faltantes
            </button>
          </div>
          <div className="modal-header-spacer" />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="trocas-body">{lista}</div>
        <div className="export-actions">
          <button type="button" className="btn-ghost" onClick={copiar}>
            {copiado ? "Copiado!" : "Copiar lista"}
          </button>
          <a className="btn-primary" href={`https://wa.me/?text=${encodeURIComponent(lista)}`} target="_blank" rel="noopener noreferrer">
            Enviar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
