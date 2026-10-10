"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ShopMatch } from "@/lib/shopMatch";

// Lojas que têm o que falta nas coleções da pessoa, da que tem mais para a que tem menos.
// A % é a compatibilidade: quanto dos faltantes de cada coleção aquela loja resolve.

const pct = (a: number, b: number) => Math.max(1, Math.round((a / b) * 100));

export default function ShopMatchModal({ onClose }: { onClose: () => void }) {
  const [shops, setShops] = useState<ShopMatch[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/lojas/compativeis")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { shops: ShopMatch[] }) => vivo && setShops(d.shops))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Lojas com o que falta">
      <div className="modal-card match-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Lojas com o que falta</span>
          {shops && shops.length > 0 && (
            <span className="modal-count">
              {shops.length} {shops.length === 1 ? "loja" : "lojas"}
            </span>
          )}
          <div className="modal-header-spacer" />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="match-body">
          {erro && <p className="match-note">Não foi possível carregar as lojas. Tente de novo em instantes.</p>}
          {!erro && !shops && <p className="match-note">Procurando lojas…</p>}
          {shops && shops.length === 0 && (
            <p className="match-note">Nenhuma loja tem, no momento, o que falta nas suas coleções.</p>
          )}
          {shops?.map((s) => (
            <div key={s.path} className="match-shop">
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
                </div>
                {s.albums.map((a) => (
                  <Link key={a.albumId} href={`${s.path}?colecao=${a.slug}`} className="match-album">
                    <div className="match-album-head">
                      <span>{a.name}</span>
                      <b>{pct(a.matched, a.missing)}%</b>
                    </div>
                    <div className="match-bar">
                      <div style={{ width: `${pct(a.matched, a.missing)}%` }} />
                    </div>
                    <small>
                      Tem {a.matched.toLocaleString("pt-BR")} das {a.missing.toLocaleString("pt-BR")} que faltam para você
                      <i>Ver loja →</i>
                    </small>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
