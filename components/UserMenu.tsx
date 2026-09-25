"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./HeaderIcons";

interface UserMenuProps {
  email: string | null;
  /** Só no álbum: exportar/importar a base de figurinhas. */
  onBackup?: () => void;
  onImport?: () => void;
}

export async function signOut() {
  await createClient().auth.signOut();
  window.location.href = "/login";
}

export default function UserMenu({ email, onBackup, onImport }: UserMenuProps) {
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
    <div className="user-menu-root" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen((v) => !v)}
        title="Minha conta"
        aria-label="Minha conta"
        aria-expanded={open}
      >
        <Icon name="user" />
      </button>
      {open && (
        <div className="user-menu">
          {email && <span className="auth-status">{email}</span>}
          <Link href="/perfil" className="btn-ghost user-menu-link" onClick={() => setOpen(false)}>
            Meu perfil
          </Link>
          {onBackup && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setOpen(false);
                onBackup();
              }}
            >
              Backup
            </button>
          )}
          {onImport && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setOpen(false);
                onImport();
              }}
            >
              Importar
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
