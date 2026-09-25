"use client";

import { useEffect, useRef, useState } from "react";
import { BLOCKS } from "@/lib/album";
import type { AlbumBlock } from "@/lib/types";

interface GroupMenuProps {
  onSelect: (blockId: string) => void;
}

interface Section {
  title: string;
  variant: "fwc" | "team" | "cc" | "leg";
  blocks: AlbumBlock[];
}

// FWC, Grupo A…L (4 seleções cada), Coca-Cola e Legends — na ordem do álbum.
const SECTIONS: Section[] = (() => {
  const out: Section[] = [];
  BLOCKS.forEach((b) => {
    const title =
      b.tipo === "TEAM" ? `Grupo ${b.grupo}` : b.tipo === "FWC" ? "FWC" : b.tipo === "CC" ? "Coca-Cola" : "Legends";
    const variant = b.tipo === "TEAM" ? "team" : b.tipo === "FWC" ? "fwc" : b.tipo === "CC" ? "cc" : "leg";
    const last = out[out.length - 1];
    if (last?.title === title) last.blocks.push(b);
    else out.push({ title, variant, blocks: [b] });
  });
  return out;
})();

function shortName(b: AlbumBlock): string {
  if (b.tipo === "FWC") return "World Cup History";
  if (b.tipo === "LEG") return b.nome.replace(/^Legends\s+/, "");
  return b.nome;
}

export default function GroupMenu({ onSelect }: GroupMenuProps) {
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
          {SECTIONS.map((s) => (
            <div key={s.title} className={`group-menu-section group-menu-${s.variant}`}>
              <span className="group-menu-title">{s.title}</span>
              <div className="group-menu-items">
                {s.blocks.map((b) => (
                  <button key={b.id} type="button" role="menuitem" title={b.nome} onClick={() => escolher(b.id)}>
                    {b.tipo === "TEAM" && <span className="group-menu-code">{b.id}</span>}
                    {shortName(b)}
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
