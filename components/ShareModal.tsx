"use client";

import { useState } from "react";
import { useCatalog } from "@/lib/CatalogContext";
import { Icon } from "./HeaderIcons";

// Compartilhar a coleção: o link público (somente leitura) e as listas em texto para mandar no
// WhatsApp — repetidas (para troca/venda) ou faltantes.

type Aba = "rep" | "miss";
type Secao = "link" | "lista";

interface ShareModalProps {
  repetidas: string;
  faltantes: string;
  onClose: () => void;
}

// Link de visualização da coleção — o token é criado na primeira vez.
async function gerarLinkPublico(albumId: string): Promise<string> {
  const res = await fetch("/api/share-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ albumId }),
  });
  if (!res.ok) throw new Error("request failed");
  const { token } = (await res.json()) as { token: string };
  return `${window.location.origin}/publico/${token}`;
}

export default function ShareModal({ repetidas, faltantes, onClose }: ShareModalProps) {
  const catalog = useCatalog();
  const [secao, setSecao] = useState<Secao>("link");
  const [aba, setAba] = useState<Aba>("rep");
  const [copiado, setCopiado] = useState(false);
  const [link, setLink] = useState<{ estado: "idle" | "busy" | "ok" | "erro"; url?: string }>({ estado: "idle" });
  const lista = aba === "rep" ? repetidas : faltantes;

  function trocar(nova: Aba) {
    setAba(nova);
    setCopiado(false);
  }

  async function copiarLista() {
    try {
      await navigator.clipboard.writeText(lista);
    } catch {
      // clipboard API unavailable — the text is still visible in the modal to copy manually
    }
    setCopiado(true);
  }

  async function copiarLink() {
    if (link.estado === "busy") return;
    setLink({ estado: "busy" });
    try {
      const url = await gerarLinkPublico(catalog.id);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // sem clipboard: o link fica visível para copiar à mão
      }
      setLink({ estado: "ok", url });
    } catch {
      setLink({ estado: "erro" });
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Compartilhar coleção">
      <div className="modal-card trocas-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Compartilhar</span>
          <div className="modal-header-spacer" />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {/* abas: cada uma com as suas ações */}
        <div className="share-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={secao === "link"} className={secao === "link" ? "active" : ""} onClick={() => setSecao("link")}>
            <Icon name="link" />
            Link da coleção
          </button>
          <button type="button" role="tab" aria-selected={secao === "lista"} className={secao === "lista" ? "active" : ""} onClick={() => setSecao("lista")}>
            <Icon name="export" />
            Lista de figurinhas
          </button>
        </div>

        {secao === "link" ? (
          <div className="share-link">
            <p>Um endereço para mostrar a sua coleção. Quem abrir vê tudo o que você tem e o que falta, sem poder alterar.</p>
            {link.estado === "ok" && <code>{link.url}</code>}
            {link.estado === "erro" && <small>Não foi possível gerar o link — tente de novo.</small>}
            <button type="button" className="btn-primary btn-with-icon" onClick={copiarLink} disabled={link.estado === "busy"}>
              <Icon name={link.estado === "ok" ? "check" : "link"} />
              {link.estado === "ok" ? "Link copiado!" : "Copiar link"}
            </button>
          </div>
        ) : (
          <>
            <div className="share-lists">
              <div className="segmented">
                <button type="button" className={`chip ${aba === "rep" ? "active" : ""}`} onClick={() => trocar("rep")}>
                  Repetidas
                </button>
                <button type="button" className={`chip ${aba === "miss" ? "active" : ""}`} onClick={() => trocar("miss")}>
                  Faltantes
                </button>
              </div>
            </div>
            <div className="trocas-body">{lista}</div>
            <div className="export-actions">
              <button type="button" className="btn-ghost btn-with-icon" onClick={copiarLista}>
                <Icon name={copiado ? "check" : "copy"} />
                {copiado ? "Copiado!" : "Copiar lista"}
              </button>
              <a
                className="btn-primary btn-with-icon"
                href={`https://wa.me/?text=${encodeURIComponent(lista)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="whatsapp" />
                Enviar no WhatsApp
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
