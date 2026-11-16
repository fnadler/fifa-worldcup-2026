"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCatalog } from "@/lib/CatalogContext";
import { valorAproximado } from "@/lib/repetidasLoja";
import { Icon } from "./HeaderIcons";

// Convite para abrir a loja, no topo da coleção, para quem já tem muitas repetidas e ainda não tem loja: mostra
// quantas são e quanto podem valer pelo preço de referência da plataforma. Fechou, volta em 14 dias (as repetidas
// continuam lá; a pessoa pode ter mudado de ideia).

const KEY = "gn-loja-convite";
const VOLTA_EM_MS = 14 * 86_400_000;

interface Props {
  repetidas: number;
  /** Valor estimado das repetidas, em centavos (0 = sem preço de referência para esta coleção). */
  valorCents: number;
  /** Dias de teste grátis; 0 = já assinou antes (sem teste). */
  trialDays: number;
  onComoFunciona: () => void;
}

export default function LojaBanner({ repetidas, valorCents, trialDays, onComoFunciona }: Props) {
  const catalog = useCatalog();
  // começa oculto: só aparece depois de ler o localStorage (evita piscar para quem fechou)
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    let fechadoEm = 0;
    try {
      fechadoEm = Number(localStorage.getItem(KEY)) || 0;
    } catch {
      // sem localStorage: mostra
    }
    if (Date.now() - fechadoEm > VOLTA_EM_MS) queueMicrotask(() => setVisivel(true));
  }, []);

  if (!visivel) return null;

  function fechar() {
    setVisivel(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // sem localStorage: fecha só nesta visita
    }
  }

  const n = repetidas.toLocaleString("pt-BR");
  const itens = catalog.itemSingular === "figurinha" ? "repetidas" : `${catalog.itemPlural} repetidos`;
  return (
    <div className="community-banner loja-banner" role="note">
      <span className="community-banner-icon loja-banner-icon" aria-hidden="true">
        <Icon name="store" />
      </span>
      <div className="community-banner-text">
        <strong>
          {valorCents > 0 ? `Suas ${n} ${itens} podem valer até ${valorAproximado(valorCents)}` : `Você tem ${n} ${itens} paradas`}
        </strong>
        <span>
          {valorCents > 0 ? "Pelo preço médio das lojas da plataforma. " : ""}
          Abra a sua loja: o catálogo sai do que você já marcou e os pedidos chegam no seu WhatsApp.{" "}
          <button type="button" className="link-button" onClick={onComoFunciona}>
            Como funciona
          </button>
        </span>
      </div>
      <Link className="btn-primary community-banner-cta" href="/assinar">
        {trialDays > 0 ? `Abrir minha loja — ${trialDays} dias grátis` : "Abrir minha loja"}
      </Link>
      <button type="button" className="modal-close" onClick={fechar} aria-label="Fechar convite da loja">
        ×
      </button>
    </div>
  );
}
