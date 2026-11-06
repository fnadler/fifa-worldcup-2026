"use client";

import { useState } from "react";
import type { DirectoryShop } from "@/lib/shopDirectory";
import ShopCard from "./ShopCard";

// Lista de lojas com filtro por coleção. Com uma coleção escolhida, o número de itens é o dela.

export default function ShopDirectory({
  shops,
  collections,
}: {
  shops: DirectoryShop[];
  collections: { albumId: string; name: string }[];
}) {
  const [albumId, setAlbumId] = useState<string | null>(null);
  // só coleções que alguma loja vende
  const opcoes = collections.filter((c) => shops.some((s) => s.albums.some((a) => a.albumId === c.albumId)));
  const visiveis = albumId ? shops.filter((s) => s.albums.some((a) => a.albumId === albumId)) : shops;

  return (
    <>
      <div className="mk-shop-filter" role="group" aria-label="Filtrar por coleção">
        <button type="button" className={albumId === null ? "on" : ""} onClick={() => setAlbumId(null)}>
          Todas
        </button>
        {opcoes.map((c) => (
          <button key={c.albumId} type="button" className={albumId === c.albumId ? "on" : ""} onClick={() => setAlbumId(c.albumId)}>
            {c.name}
          </button>
        ))}
      </div>
      {visiveis.length > 0 ? (
        <div className="mk-shop-grid">
          {/* a oficial já vem primeiro (listShops) */}
          {visiveis.map((s) => (
            <ShopCard key={s.path} shop={s} albumId={albumId} />
          ))}
        </div>
      ) : (
        <p className="mk-shop-empty">Nenhuma loja vende essa coleção no momento.</p>
      )}
    </>
  );
}
