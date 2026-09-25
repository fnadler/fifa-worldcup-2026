"use client";

import { useMemo, useRef, useState } from "react";
import { deriveBoard } from "@/lib/derive";
import { useViewMode } from "@/lib/useViewMode";
import type { Qtd, StatusFiltro, TipoFiltro } from "@/lib/types";
import PublicHeader from "./PublicHeader";
import AlbumBlockCard from "./AlbumBlockCard";

interface PublicBoardProps {
  qtd: Qtd;
  collectionName: string;
}

export default function PublicBoard({ qtd, collectionName }: PublicBoardProps) {
  const [tipo, setTipo] = useState<TipoFiltro>("ALL");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("ALL");
  const [busca, setBusca] = useState("");
  const [view, setView] = useViewMode("copa2026-public-view");
  const headerRef = useRef<HTMLDivElement | null>(null);

  const derived = useMemo(
    () => deriveBoard(qtd, tipo, statusFiltro, busca),
    [qtd, tipo, statusFiltro, busca]
  );

  function scrollToBlock(id: string) {
    const el = document.getElementById(`bl-${id}`);
    if (!el || !headerRef.current) return;
    const offset = headerRef.current.getBoundingClientRect().height + 12;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <PublicHeader
        headerRef={headerRef}
        totColadas={derived.totColadas}
        totGeral={derived.totGeral}
        totRepetidas={derived.totRepetidas}
        totFaltam={derived.totFaltam}
        busca={busca}
        onBusca={setBusca}
        tipo={tipo}
        onTipo={setTipo}
        statusFiltro={statusFiltro}
        onStatusFiltro={setStatusFiltro}
        collectionName={collectionName}
        view={view}
        onView={setView}
        onAnchorClick={scrollToBlock}
      />

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
      </div>

      <div className="board">
        {derived.visibleBlocks.map((vb) => (
          <AlbumBlockCard key={vb.block.id} vb={vb} readOnly view={view} />
        ))}
        {derived.visibleBlocks.length === 0 && (
          <div className="empty-message">Nenhuma figurinha com esses filtros.</div>
        )}
      </div>
    </div>
  );
}
