"use client";

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
          {collections.map((c) => (
            <Link
              key={c.albumId}
              href={`/colecao/${c.slug}`}
              role="menuitem"
              className={`user-menu-item collection-switcher-item ${c.albumId === catalog.id ? "is-current" : ""}`}
              onClick={() => setOpen(false)}
            >
              <strong>{collectionTitleOf(c)}</strong>
              <span>{c.albumName}</span>
            </Link>
          ))}
          <Link href="/colecoes" role="menuitem" className="user-menu-item user-menu-cta" onClick={() => setOpen(false)}>
            + Adicionar coleção
          </Link>
        </div>
      )}
    </div>
  );
}
