"use client";

import { useMemo, useRef, useState } from "react";
import { backupText, parseBackupText } from "@/lib/localBackup";
import type { Qtd } from "@/lib/types";

interface BackupModalProps {
  mode: "export" | "import";
  qtd: Qtd;
  onClose: () => void;
  onRestore: (qtd: Qtd) => void;
}

export default function BackupModal({ mode, qtd, onClose, onRestore }: BackupModalProps) {
  const [copiado, setCopiado] = useState(false);
  const [importText, setImportText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const exportText = useMemo(() => backupText(qtd), [qtd]);
  const count = Object.keys(qtd).length;
  const isImport = mode === "import";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(exportText);
    } catch {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          // last-resort fallback failed too — text stays selected for a manual Cmd+C
        }
      }
    }
    setCopiado(true);
  }

  function baixarArquivo() {
    try {
      const txt = backupText(qtd, true);
      const a = document.createElement("a");
      a.href = `data:application/json;charset=utf-8,${encodeURIComponent(txt)}`;
      a.download = `figurinhas-copa2026-${new Date().toISOString().slice(0, 10)}.json`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      // download blocked by the environment — Copiar continua disponível
    }
  }

  function aplicarImport() {
    try {
      const parsed = parseBackupText(importText);
      onRestore(parsed);
      onClose();
    } catch {
      alert("Texto inválido — cole o backup completo, começando com {");
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isImport ? "Restaurar base" : "Backup da base"}
    >
      <div className="modal-card backup-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isImport ? "Restaurar base" : "Backup da base"}</span>
          <div className="modal-header-spacer" />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-notice">
          {isImport
            ? "Cole aqui o texto do backup e clique em Restaurar. Isso substitui a base atual."
            : `Este texto é a sua base completa (${count} figurinhas). Copie e guarde em uma nota, e-mail ou arquivo.`}
        </div>
        {isImport ? (
          <textarea
            className="backup-textarea"
            placeholder="Cole aqui o texto do backup..."
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
        ) : (
          <textarea ref={textareaRef} className="backup-textarea" readOnly value={exportText} />
        )}
        <div className="modal-actions">
          {isImport ? (
            <button type="button" className="btn-restore" onClick={aplicarImport}>
              Restaurar base
            </button>
          ) : (
            <>
              <button type="button" className="btn-primary" onClick={copiar}>
                {copiado ? "Copiado!" : "Copiar"}
              </button>
              <button type="button" className="btn-ghost" onClick={baixarArquivo}>
                Tentar baixar arquivo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
