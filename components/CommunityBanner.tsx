"use client";

import { useEffect, useState } from "react";
import { COMMUNITY_URL } from "@/lib/community";
import { Icon } from "./HeaderIcons";

// Convite para o grupo de WhatsApp da comunidade, no topo da coleção. Fechou (ou entrou), não volta —
// o convite continua no menu da conta.

const KEY = "gn-comunidade-convite";

export default function CommunityBanner() {
  // começa oculto: só aparece depois de ler o localStorage (evita piscar para quem já fechou)
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    let fechado = false;
    try {
      fechado = Boolean(localStorage.getItem(KEY));
    } catch {
      // sem localStorage: mostra
    }
    if (!fechado) queueMicrotask(() => setVisivel(true));
  }, []);

  if (!COMMUNITY_URL || !visivel) return null;

  function fechar() {
    setVisivel(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // sem localStorage: fecha só nesta visita
    }
  }

  return (
    <div className="community-banner" role="note">
      <span className="community-banner-icon" aria-hidden="true">
        <Icon name="whatsapp" />
      </span>
      <div className="community-banner-text">
        <strong>Entre na comunidade GN Coleciona</strong>
        <span>Um grupo no WhatsApp para trocar, comprar e vender com outros colecionadores.</span>
      </div>
      <a className="btn-primary community-banner-cta" href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" onClick={fechar}>
        Entrar no grupo
      </a>
      <button type="button" className="modal-close" onClick={fechar} aria-label="Fechar convite">
        ×
      </button>
    </div>
  );
}
