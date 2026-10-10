"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Desktop: o painel (largo, posicionado em relação ao cabeçalho) abre logo abaixo do botão, alinhado
  // a ele até onde couber na tela. No celular vale o CSS.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const toggle = toggleRef.current;
    if (!open || !panel || !toggle || window.innerWidth <= 700) return;
    const parent = (panel.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    if (!parent) return;
    const btn = toggle.getBoundingClientRect();
    const left = Math.max(18, Math.min(btn.left - parent.left, parent.width - panel.offsetWidth - 18));
    panel.style.left = `${left}px`;
    panel.style.top = `${btn.bottom - parent.top + 8}px`;
  }, [open]);

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
        ref={toggleRef}
      >
        Grupos <span className="group-menu-caret">▾</span>
      </button>

      {open && (
        <div className="group-menu-panel" role="menu" ref={panelRef}>
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
