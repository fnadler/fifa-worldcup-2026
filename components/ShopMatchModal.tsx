"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "@/lib/CatalogContext";
import type { MatchCount, ShopMatchResult } from "@/lib/shopMatch";

// Lojas que têm o que falta na coleção aberta. A % é a compatibilidade: quanto dos faltantes (no total
// ou da categoria escolhida) aquela loja resolve. Com uma categoria no filtro, só entram lojas que têm
// algo dela, ordenadas pela % dessa categoria.

const pct = (c: MatchCount) => (c.matched ? Math.max(1, Math.round((c.matched / c.missing) * 100)) : 0);

function Bar({ label, count, main }: { label: string; count: MatchCount; main?: boolean }) {
  return (
    <div className={`match-row${main ? " main" : ""}${count.matched ? "" : " zero"}`}>
      <div className="match-row-head">
        <span>{label}</span>
        <small>
          {count.matched.toLocaleString("pt-BR")} de {count.missing.toLocaleString("pt-BR")}
        </small>
        <b>{pct(count)}%</b>
      </div>
      <div className="match-bar">
        <div style={{ width: `${pct(count)}%` }} />
      </div>
    </div>
  );
}

export default function ShopMatchModal({ onClose }: { onClose: () => void }) {
  const catalog = useCatalog();
  const [data, setData] = useState<ShopMatchResult | null>(null);
  const [erro, setErro] = useState(false);
  const [categoria, setCategoria] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/lojas/compativeis?album=${encodeURIComponent(catalog.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: ShopMatchResult) => vivo && setData(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [catalog.id]);

  const shops = useMemo(() => {
    if (!data) return [];
    if (!categoria) return data.shops;
    return data.shops
      .filter((s) => (s.categories[categoria]?.matched ?? 0) > 0)
      .sort((a, b) => pct(b.categories[categoria]) - pct(a.categories[categoria]) || b.categories[categoria].matched - a.categories[categoria].matched);
  }, [data, categoria]);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Lojas com o que falta">
      <div className="modal-card match-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Lojas com o que falta</span>
          <span className="modal-count">{catalog.shortName}</span>
          <div className="modal-header-spacer" />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {data && data.shops.length > 0 && data.categories.length > 1 && (
          <div className="match-filter" role="group" aria-label="Filtrar por categoria">
            <button type="button" className={`chip ${categoria === null ? "active" : ""}`} onClick={() => setCategoria(null)}>
              Tudo · {data.missing.toLocaleString("pt-BR")}
            </button>
            {data.categories.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`chip ${categoria === c.key ? "active" : ""}`}
                onClick={() => setCategoria(c.key)}
                disabled={c.missing === 0}
                title={c.missing === 0 ? "Você já tem todas dessa categoria" : undefined}
              >
                {c.label} · {c.missing === 0 ? "completa" : c.missing.toLocaleString("pt-BR")}
              </button>
            ))}
          </div>
        )}
        <div className="match-body">
          {erro && <p className="match-note">Não foi possível carregar as lojas. Tente de novo em instantes.</p>}
          {!erro && !data && <p className="match-note">Procurando lojas…</p>}
          {data && data.shops.length === 0 && (
            <p className="match-note">Nenhuma loja tem, no momento, o que falta nesta coleção.</p>
          )}
          {data && data.shops.length > 0 && shops.length === 0 && (
            <p className="match-note">Nenhuma loja tem, no momento, o que falta dessa categoria.</p>
          )}
          {data &&
            shops.map((s) => (
              <Link key={s.path} href={`${s.path}?colecao=${data.slug}`} className="match-shop">
                <div className="match-logo">
                  {s.logoUrl ? (
                    <Image src={s.logoUrl} alt="" width={112} height={112} unoptimized />
                  ) : (
                    <span>{s.name.trim().charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="match-info">
                  <div className="match-name">
                    <strong>{s.name}</strong>
                    {s.official && <em>Loja oficial</em>}
                    <i>Ver loja →</i>
                  </div>
                  <Bar label={categoria ? "Total da coleção" : "Do que falta para você"} count={s} main={!categoria} />
                  {data.categories.length > 1 &&
                    data.categories
                      .filter((c) => c.missing > 0)
                      .map((c) => <Bar key={c.key} label={c.label} count={s.categories[c.key]} main={categoria === c.key} />)}
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
