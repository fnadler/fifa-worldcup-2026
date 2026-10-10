"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { DirectoryShop } from "@/lib/shopDirectory";

// Lista de lojas com filtro por coleção. Com uma coleção escolhida, o número de itens é o dela.

function Logo({ shop }: { shop: DirectoryShop }) {
  return shop.logoUrl ? (
    <Image src={shop.logoUrl} alt="" width={400} height={400} unoptimized />
  ) : (
    <span>{shop.name.trim().charAt(0).toUpperCase()}</span>
  );
}

function ShopCard({ shop, albumId }: { shop: DirectoryShop; albumId: string | null }) {
  const items = albumId ? (shop.albums.find((a) => a.albumId === albumId)?.items ?? 0) : shop.items;
  return (
    <Link href={shop.path} className={`mk-shop-card${shop.official ? " official" : ""}`}>
      <div className="mk-shop-logo">
        <Logo shop={shop} />
        {shop.official && <span className="mk-shop-official">★ Loja oficial</span>}
      </div>
      <div className="mk-shop-info">
        <strong>{shop.name}</strong>
        <div className="mk-shop-badges">
          {shop.albums.map((a) => (
            <span key={a.albumId} className={a.albumId === albumId ? "on" : ""}>
              {a.name}
            </span>
          ))}
        </div>
        <small>
          {items.toLocaleString("pt-BR")} {items === 1 ? "item único" : "itens únicos"}
        </small>
      </div>
    </Link>
  );
}

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
