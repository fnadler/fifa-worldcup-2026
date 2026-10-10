"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCatalog } from "@/lib/CatalogContext";
import { collectionTitleOf, type UserCollection } from "@/lib/userCollections";

// Acima do título: a coleção aberta (ex: "Adrenalyn XL ▾") e a troca para as outras da pessoa.
// `variant="button"`: o mesmo menu num botão da linha de controles (desktop).
export default function CollectionSwitcher({ collections, variant }: { collections: UserCollection[]; variant?: "button" }) {
  const catalog = useCatalog();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`collection-switcher${variant === "button" ? " collection-switcher-row" : ""}`} ref={rootRef}>
      <button
        type="button"
        className={variant === "button" ? "btn-ghost collection-switcher-button" : "kicker collection-switcher-toggle"}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Trocar de coleção"
      >
        {variant === "button" ? catalog.shortName : catalog.name} <span className="collection-switcher-caret">▾</span>
      </button>
      {open && (
        <div className="user-menu collection-switcher-menu" role="menu">
          <span className="user-menu-group-title">Minhas coleções</span>
          <div className="collection-cards" style={{ ["--cols" as string]: Math.min(collections.length + 1, 3) }}>
            {collections.map((c) => {
              const current = c.albumId === catalog.id;
              return (
                <Link
                  key={c.albumId}
                  href={`/colecao/${c.slug}`}
                  role="menuitem"
                  className={`collection-card${current ? " is-current" : ""}`}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="collection-card-cover">
                    <Cover slug={c.slug} name={c.albumName} />
                    {current && <em>Aberta</em>}
                  </span>
                  <strong>{c.albumName}</strong>
                  <small>{collectionTitleOf(c)}</small>
                </Link>
              );
            })}
            <Link href="/colecoes" role="menuitem" className="collection-card collection-card-add" onClick={() => setOpen(false)}>
              <span className="collection-card-cover">
                <b aria-hidden="true">+</b>
              </span>
              <strong>Adicionar coleção</strong>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Capa do álbum (public/brand/albums/<slug>.webp). Sem arquivo, fica o nome sobre o fundo do card.
function Cover({ slug, name }: { slug: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="collection-card-nocover">{name}</span>;
  return <Image src={`/brand/albums/${slug}.webp`} alt="" width={240} height={320} unoptimized onError={() => setFailed(true)} />;
}
