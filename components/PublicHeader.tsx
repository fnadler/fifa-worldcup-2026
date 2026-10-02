"use client";

import { useState, type RefObject } from "react";
import { VIEW_OPTIONS } from "@/lib/useViewMode";
import { useCatalog } from "@/lib/CatalogContext";
import GroupMenu from "./GroupMenu";
import { FiltersFooter, ViewToggleButton } from "./HeaderIcons";
import type { ViewMode, StatusFiltro, TipoFiltro } from "@/lib/types";
import BrandLogo from "./BrandLogo";

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
  collectionName: string;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  onClearFilters: () => void;
  onAnchorClick: (id: string) => void;
}

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
  collectionName,
  view,
  onView,
  onClearFilters,
  onAnchorClick,
}: PublicHeaderProps) {
  const catalog = useCatalog();
  const tipos = catalog.filters;
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
            <BrandLogo />
            <span className="kicker">{catalog.name}</span>
            <span className="title">{collectionName}</span>
          </div>

          <div className="totals-row">
            <div className="total-card">
              <span className="total-value" style={{ color: "var(--positive)" }}>
                {totColadas}
                <span className="denom">/{totGeral}</span>
              </span>
              <span className="total-label">{catalog.owned.total}</span>
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

          <ViewToggleButton view={view} onChange={onView} />

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
              placeholder={catalog.searchPlaceholder}
              value={busca}
              onChange={(e) => onBusca(e.target.value)}
              className="search-input"
            />

            <div className="segmented">
              {tipos.map((t) => (
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

            <div className="segmented view-segment">
              {VIEW_OPTIONS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  className={`chip ${view === v.value ? "active" : ""}`}
                  onClick={() => onView(v.value)}
                >
                  {v.label}
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

            <GroupMenu onSelect={anchorClickAndClose} />
          </div>

          <FiltersFooter
            onClear={onClearFilters}
            onApply={() => {
              setMenuAberto(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </div>
    </div>
  );
}
