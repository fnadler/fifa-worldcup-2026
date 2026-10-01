"use client";

import { useEffect, useRef, useState } from "react";
import { useCatalog } from "@/lib/CatalogContext";

interface GroupMenuProps {
  onSelect: (blockId: string) => void;
  /** Se informado, lista só esses blocos (ex: loja que mostra só o que está à venda). */
  onlyIds?: Set<string>;
}

export default function GroupMenu({ onSelect, onlyIds }: GroupMenuProps) {
  const catalog = useCatalog();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open]);

  const sections = onlyIds
    ? catalog.menuSections
        .map((s) => ({ ...s, blocks: s.blocks.filter((b) => onlyIds.has(b.id)) }))
        .filter((s) => s.blocks.length)
    : catalog.menuSections;

  function escolher(id: string) {
    setOpen(false);
    onSelect(id);
  }

  return (
    <div className="group-menu" ref={rootRef}>
      <button
        type="button"
        className={`btn-ghost group-menu-toggle ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Grupos <span className="group-menu-caret">▾</span>
      </button>

      {open && (
        <div className="group-menu-panel" role="menu">
          {sections.map((s) => (
            <div key={s.title} className={`group-menu-section group-menu-${s.variant}`}>
              <span className="group-menu-title">{s.title}</span>
              <div className="group-menu-items">
                {s.blocks.map((b) => (
                  <button key={b.id} type="button" role="menuitem" title={b.nome} onClick={() => escolher(b.id)}>
                    {catalog.menuCode(b) && <span className="group-menu-code">{catalog.menuCode(b)}</span>}
                    {catalog.menuLabel(b)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
