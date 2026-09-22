"use client";

import { useState, type RefObject } from "react";
import type { Anchor, StatusFiltro, TipoFiltro } from "@/lib/types";

interface PublicHeaderProps {
  headerRef: RefObject<HTMLDivElement | null>;
  totColadas: number;
  totGeral: number;
  totRepetidas: number;
  totFaltam: number;
  busca: string;
  onBusca: (v: string) => void;
  tipo: TipoFiltro;
  onTipo: (v: TipoFiltro) => void;
  statusFiltro: StatusFiltro;
  onStatusFiltro: (v: StatusFiltro) => void;
  anchoras: Anchor[];
  onAnchorClick: (id: string) => void;
}

const TIPOS: { value: TipoFiltro; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "TEAM", label: "Seleções" },
  { value: "FWC", label: "FWC" },
  { value: "CC", label: "Coca-Cola" },
];

const STATUSES: { value: StatusFiltro; label: string }[] = [
  { value: "ALL", label: "Tudo" },
  { value: "REP", label: "Só repetidas" },
  { value: "MISS", label: "Só faltantes" },
];

export default function PublicHeader({
  headerRef,
  totColadas,
  totGeral,
  totRepetidas,
  totFaltam,
  busca,
  onBusca,
  tipo,
  onTipo,
  statusFiltro,
  onStatusFiltro,
  anchoras,
  onAnchorClick,
}: PublicHeaderProps) {
  const [menuAberto, setMenuAberto] = useState(false);

  function anchorClickAndClose(id: string) {
    setMenuAberto(false);
    onAnchorClick(id);
  }

  return (
    <div className="header" ref={headerRef}>
      <div className="header-inner">
        <div className="header-main-row">
          <div className="brand">
            <span className="kicker">Coleção pública · somente leitura</span>
            <span className="title">Álbum Copa 2026</span>
          </div>

          <div className="totals-row">
            <div className="total-card">
              <span className="total-value" style={{ color: "var(--positive)" }}>
                {totColadas}
                <span className="denom">/{totGeral}</span>
              </span>
              <span className="total-label">Coladas</span>
            </div>
            <div className="total-card">
              <span className="total-value" style={{ color: "var(--gold)" }}>
                {totRepetidas}
              </span>
              <span className="total-label">Repetidas</span>
            </div>
            <div className="total-card">
              <span className="total-value" style={{ color: "var(--danger)" }}>
                {totFaltam}
              </span>
              <span className="total-label">Faltam</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-ghost mobile-menu-button"
            onClick={() => setMenuAberto((v) => !v)}
          >
            Filtros
          </button>
        </div>

        <div className={`filters-panel ${menuAberto ? "is-open" : ""}`}>
          <button
            type="button"
            className="modal-close filters-panel-close"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar filtros"
          >
            ×
          </button>

          <div className="controls-row">
            <input
              type="search"
              placeholder="Buscar seleção ou código (ex: BRA9)"
              value={busca}
              onChange={(e) => onBusca(e.target.value)}
              className="search-input"
            />

            <div className="segmented">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`chip ${tipo === t.value ? "active" : ""}`}
                  onClick={() => onTipo(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="segmented">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`chip ${statusFiltro === s.value ? "active" : ""}`}
                  onClick={() => onStatusFiltro(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="anchors-row">
            {anchoras.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.title}
                className={`anchor-btn ${a.variant !== "team" ? `anchor-${a.variant}` : ""}`}
                onClick={() => anchorClickAndClose(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
