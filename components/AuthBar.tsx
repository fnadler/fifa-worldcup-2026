"use client";

import { useEffect, useRef, useState } from "react";
import type { AppUser } from "@/lib/types";

interface AuthBarProps {
  user: AppUser;
  onSignOut: () => void;
}

export default function AuthBar({ user, onSignOut }: AuthBarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="auth-bar" ref={rootRef}>
      <button
        type="button"
        className="user-icon-button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Conta"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
        </svg>
      </button>
      {open && (
        <div className="user-menu">
          <span className="auth-status">{user.email}</span>
          <button type="button" className="btn-ghost" onClick={onSignOut}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
