"use client";

import { useState, type RefObject } from "react";
import { VIEW_OPTIONS } from "@/lib/useViewMode";
import type { ViewMode, AppUser, ModoClique, StatusFiltro, TipoFiltro } from "@/lib/types";
import { CopyLinkButton, HeaderActions, NavSwitch } from "./HeaderIcons";
import GroupMenu from "./GroupMenu";
import UserMenu from "./UserMenu";
import BrandLogo from "./BrandLogo";
import { PLATFORM_NAME } from "@/lib/brand";

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
  onExportar: () => void;
  onImportar: () => void;
  onAnchorClick: (id: string) => void;
  user: AppUser;
  shopHref: string | null;
  collectionName: string;
  onToast: (msg: string) => void;
}

const TIPOS: { value: TipoFiltro; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "TEAM", label: "Seleções" },
  { value: "FWC", label: "FWC" },
  { value: "CC", label: "Coca-Cola" },
  { value: "LEG", label: "Legends" },
];

const STATUSES: { value: StatusFiltro; label: string }[] = [
  { value: "ALL", label: "Tudo" },
  { value: "REP", label: "Só repetidas" },
  { value: "MISS", label: "Só faltantes" },
];

const MODOS: { value: ModoClique; label: string }[] = [
  { value: "add", label: "+ Somar" },
  { value: "sub", label: "− Tirar" },
];

// Link de visualização (somente leitura) do álbum — o token é criado na primeira vez.
async function gerarLinkPublico(): Promise<string> {
  const res = await fetch("/api/share-link", { method: "POST" });
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
  onExportar,
  onImportar,
  onAnchorClick,
  user,
  shopHref,
  collectionName,
  onToast,
}: HeaderProps) {
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
            <span className="kicker">{PLATFORM_NAME}</span>
            <span className="title">{collectionName}</span>
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

          <div className="segmented modo-segment">
            {MODOS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`chip ${modo === m.value ? "active" : ""}`}
                onClick={() => onModo(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn-ghost mobile-menu-button"
            onClick={() => setMenuAberto((v) => !v)}
          >
            Filtros
          </button>

          <HeaderActions>
            {shopHref && <NavSwitch active="album" shopHref={shopHref} />}
            <CopyLinkButton
              text="Copiar link"
              label="Copiar link público do álbum"
              url={gerarLinkPublico}
              successMessage="Link público do álbum copiado!"
              onToast={onToast}
            />
            <UserMenu email={user.email} shopSettings={!!shopHref} onBackup={onExportar} onImport={onImportar} />
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

            <button type="button" className="btn-primary" onClick={onAbrirTrocas}>
              Minhas repetidas
            </button>
            <GroupMenu onSelect={anchorClickAndClose} />
          </div>
        </div>
      </div>
    </div>
  );
}
