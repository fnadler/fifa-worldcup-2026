"use client";

import { useState, type RefObject } from "react";
import { VIEW_OPTIONS } from "@/lib/useViewMode";
import { useCatalog } from "@/lib/CatalogContext";
import type { ViewMode, AppUser, ModoClique, StatusFiltro, TipoFiltro } from "@/lib/types";
import { CopyLinkButton, FiltersFooter, HeaderActions, Icon, NavSwitch, ViewToggleButton } from "./HeaderIcons";
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
  modo: ModoClique;
  onModo: (v: ModoClique) => void;
  onAbrirTrocas: () => void;
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
  onToast: (msg: string) => void;
  /** Volta busca, tipo e status ao padrão (botão "Limpar filtros" do celular). */
  onClearFilters: () => void;
}

const STATUSES: { value: StatusFiltro; label: string }[] = [
  { value: "ALL", label: "Tudo" },
  { value: "REP", label: "Só repetidas" },
  { value: "MISS", label: "Só faltantes" },
];

const MODOS: { value: ModoClique; label: string }[] = [
  { value: "add", label: "+ Somar" },
  { value: "sub", label: "− Tirar" },
];

// Link de visualização (somente leitura) da coleção — o token é criado na primeira vez.
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
  modo,
  onModo,
  onAbrirTrocas,
  onAbrirLojas,
  onExportar,
  onImportar,
  onAnchorClick,
  user,
  shopHref,
  shopActive,
  collectionName,
  collections,
  onToast,
  onClearFilters,
}: HeaderProps) {
  const catalog = useCatalog();
  const tipos = catalog.filters;
  const [menuAberto, setMenuAberto] = useState(false);

  // Totais: no celular ficam na linha do título; no desktop, no centro da linha de controles.
  const totais = (extra: string) => (
    <div className={`totals-row ${extra}`}>
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
  );

  // Somar/Tirar: no celular fica na linha do título; no desktop, à direita da linha de filtros.
  const modoSegment = (extra: string) => (
    <div className={`segmented modo-segment ${extra}`}>
      {MODOS.map((m) => (
        <button key={m.value} type="button" className={`chip ${modo === m.value ? "active" : ""}`} onClick={() => onModo(m.value)}>
          {m.label}
        </button>
      ))}
    </div>
  );

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
            <CollectionSwitcher collections={collections} />
            <span className="title">{collectionName}</span>
          </div>

          {totais("totals-mobile")}

          {modoSegment("modo-mobile")}

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
            <CopyLinkButton
              text="Copiar link"
              label="Copiar link público da coleção"
              url={() => gerarLinkPublico(catalog.id)}
              successMessage="Link público da coleção copiado!"
              onToast={onToast}
            />
            <UserMenu email={user.email} shopActive={shopActive} onBackup={onExportar} onImport={onImportar} />
          </HeaderActions>
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

          {/* linha de controles e ações: como ver e marcar (esquerda) · exportar e lojas (direita) */}
          <div className="controls-row controls-row-2">
            <div className="controls-group">
            <CollectionSwitcher collections={collections} variant="button" />
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
            {modoSegment("modo-desktop")}
            </div>
            {totais("totals-desktop")}
            <div className="controls-group controls-group-end">
            <button type="button" className="icon-button export-button" data-tip="Exportar" aria-label="Exportar lista" onClick={onAbrirTrocas}>
              <Icon name="export" />
              <span>Exportar lista</span>
            </button>
            {onAbrirLojas && (
              <button type="button" className="btn-lojas" onClick={onAbrirLojas}>
                Onde comprar as que faltam
              </button>
            )}
            </div>
          </div>

          {/* linha de filtros (a última) */}
          <div className="controls-row controls-row-filters">
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
