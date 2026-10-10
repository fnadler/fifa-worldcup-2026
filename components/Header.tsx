"use client";

import { useState, type RefObject } from "react";
import { PLATFORM_NAME } from "@/lib/brand";
import { VIEW_OPTIONS } from "@/lib/useViewMode";
import { useCatalog } from "@/lib/CatalogContext";
import type { ViewMode, AppUser, StatusFiltro, TipoFiltro } from "@/lib/types";
import { FiltersFooter, HeaderActions, Icon, NavSwitch, ViewToggleButton } from "./HeaderIcons";
import GroupMenu from "./GroupMenu";
import UserMenu from "./UserMenu";
import BrandLogo from "./BrandLogo";
import CollectionSwitcher from "./CollectionSwitcher";
import type { UserCollection } from "@/lib/userCollections";

interface HeaderProps {
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
  view: ViewMode;
  onView: (v: ViewMode) => void;
  /** Abre o modal de compartilhar (link público + listas de repetidas/faltantes). */
  onCompartilhar: () => void;
  /** Lojas com o que falta — só quando a pessoa já tem algum item (sem nada, tudo "falta"). */
  onAbrirLojas?: () => void;
  onExportar: () => void;
  onImportar: () => void;
  onAnchorClick: (id: string) => void;
  user: AppUser;
  shopHref: string;
  shopActive: boolean;
  collectionName: string;
  collections: UserCollection[];
  /** Volta busca, tipo e status ao padrão (botão "Limpar filtros" do celular). */
  onClearFilters: () => void;
}

const STATUSES: { value: StatusFiltro; label: string }[] = [
  { value: "ALL", label: "Tudo" },
  { value: "REP", label: "Só repetidas" },
  { value: "MISS", label: "Só faltantes" },
];

export default function Header({
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
  view,
  onView,
  onCompartilhar,
  onAbrirLojas,
  onExportar,
  onImportar,
  onAnchorClick,
  user,
  shopHref,
  shopActive,
  collectionName,
  collections,
  onClearFilters,
}: HeaderProps) {
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
        {/* Desktop, uma linha só: logo + nome · coleção · totais · Minhas coleções/Minha loja · compartilhar ·
            conta · Quero completar. No celular os itens se reordenam em linhas e "Quero completar" fica
            fixo no rodapé da tela (ver globals.css). */}
        <div className="header-main-row">
          <div className="brand">
            <BrandLogo />
            <span className="kicker">{PLATFORM_NAME}</span>
            <span className="title">{collectionName}</span>
          </div>

          <CollectionSwitcher collections={collections} variant="button" />

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

          <NavSwitch active="album" shopHref={shopHref} />

          <HeaderActions>
            <button type="button" className="icon-button" data-tip="Compartilhar" aria-label="Compartilhar coleção" onClick={onCompartilhar}>
              <Icon name="export" />
            </button>
            <UserMenu email={user.email} shopActive={shopActive} onBackup={onExportar} onImport={onImportar} />
          </HeaderActions>

          {onAbrirLojas && (
            <button type="button" className="btn-primary btn-completar" onClick={onAbrirLojas}>
              Quero completar
            </button>
          )}
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

          <div className="controls-row controls-row-filters">
            <div className="segmented view-segment">
              {VIEW_OPTIONS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  className={`chip chip-icon ${view === v.value ? "active" : ""}`}
                  onClick={() => onView(v.value)}
                >
                  <Icon name={v.value === "grid" ? "grid" : "photo"} />
                  {v.label}
                </button>
              ))}
            </div>

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

            <GroupMenu onSelect={anchorClickAndClose} />

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
