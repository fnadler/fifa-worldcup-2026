"use client";

import type { AppUser, ModoClique, SyncStatus } from "@/lib/types";

interface LegendBarProps {
  modo: ModoClique;
  user: AppUser | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  qtdCount: number;
}

function statusText({ user, syncStatus, lastSyncedAt, qtdCount }: LegendBarProps): string {
  if (!user) {
    if (!qtdCount) return "Nada registrado ainda — sua marcação é salva neste navegador";
    return `Salvo neste navegador · ${qtdCount} figurinhas — entre para sincronizar entre aparelhos`;
  }
  const hora = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";
  if (syncStatus === "saving") return "Salvando…";
  if (syncStatus === "offline") return "Offline — alterações pendentes";
  if (syncStatus === "error") return "Não foi possível sincronizar — tentando de novo";
  return qtdCount ? `Sincronizado ${hora} · ${qtdCount} figurinhas na base` : "Nada registrado ainda";
}

export default function LegendBar(props: LegendBarProps) {
  const { modo, syncStatus } = props;
  const isErrorish = syncStatus === "error" || syncStatus === "offline";
  const dica =
    modo === "add"
      ? "Clique na figurinha para somar uma unidade · clique direito (ou modo Tirar) para remover"
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
        colada
      </span>
      <span className="legend-item">
        <i className="legend-swatch swatch-dup" />
        tenho repetida
      </span>
      <span className="legend-hint">{dica}</span>
      <div className="legend-spacer" />
      <span className={`sync-indicator ${isErrorish ? "is-error" : ""}`}>
        <i className="sync-dot" />
        {statusText(props)}
      </span>
    </div>
  );
}
