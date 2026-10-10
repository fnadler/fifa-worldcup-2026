"use client";

import { POSITION_LABELS } from "@/lib/album";
import { useCatalog } from "@/lib/CatalogContext";
import type { ModoClique, SyncStatus } from "@/lib/types";

interface LegendBarProps {
  modo: ModoClique;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  qtdCount: number;
}

function statusText({ syncStatus, lastSyncedAt, qtdCount }: LegendBarProps, itemPlural: string): string {
  const hora = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";
  if (syncStatus === "saving") return "Salvando…";
  if (syncStatus === "offline") return "Offline — alterações pendentes";
  if (syncStatus === "error") return "Não foi possível sincronizar — tentando de novo";
  return qtdCount ? `Sincronizado ${hora} · ${qtdCount} ${itemPlural} na base` : "Nada registrado ainda";
}

export default function LegendBar(props: LegendBarProps) {
  const { modo, syncStatus } = props;
  const catalog = useCatalog();
  const item = catalog.itemSingular;
  const temPosicao = catalog.blocks.some((b) => b.positions);
  const isErrorish = syncStatus === "error" || syncStatus === "offline";
  const dica =
    modo === "add"
      ? `Clique n${item === "figurinha" ? "a" : "o"} ${item} para somar uma unidade · clique direito (no celular, modo Tirar) para remover`
      : "Modo TIRAR: cada clique remove uma unidade";

  return (
    <div className="legend-bar">
      <span className="legend-label">Legenda</span>
      <span className="legend-item">
        <i className="legend-swatch swatch-empty" />
        falta
      </span>
      <span className="legend-item">
        <i className="legend-swatch swatch-full" />
        {catalog.owned.cell}
      </span>
      <span className="legend-item">
        <i className="legend-swatch swatch-dup" />
        tenho repetida
      </span>
      {temPosicao && (
        <span className="legend-item legend-positions">
          {Object.entries(POSITION_LABELS).map(([k, v]) => (
            <span key={k} className="legend-pos" data-pos={k}>
              {v}
            </span>
          ))}
        </span>
      )}
      <span className="legend-hint">{dica}</span>
      <div className="legend-spacer" />
      <span className={`sync-indicator ${isErrorish ? "is-error" : ""}`}>
        <i className="sync-dot" />
        {statusText(props, catalog.itemPlural)}
      </span>
    </div>
  );
}
