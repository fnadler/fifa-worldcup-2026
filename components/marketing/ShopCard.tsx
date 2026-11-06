import Image from "next/image";
import Link from "next/link";
import type { DirectoryShop } from "@/lib/shopDirectory";

// Card de uma loja: em /lojas (com o filtro por coleção) e no bloco de lojistas da landing.
// Com uma coleção escolhida, o número de itens é o dela.

function Logo({ shop }: { shop: DirectoryShop }) {
  return shop.logoUrl ? (
    <Image src={shop.logoUrl} alt="" width={400} height={400} unoptimized />
  ) : (
    <span>{shop.name.trim().charAt(0).toUpperCase()}</span>
  );
}

export default function ShopCard({ shop, albumId = null }: { shop: DirectoryShop; albumId?: string | null }) {
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
          {shop.products > 0 && <span>Produtos</span>}
        </div>
        <small>
          {items.toLocaleString("pt-BR")} {items === 1 ? "item único" : "itens únicos"}
        </small>
      </div>
    </Link>
  );
}

