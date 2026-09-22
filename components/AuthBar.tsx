"use client";

import { useEffect, useRef, useState } from "react";
import type { AppUser } from "@/lib/types";

interface AuthBarProps {
  user: AppUser;
  onSignOut: () => void;
}

export default function AuthBar({ user, onSignOut }: AuthBarProps) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareLabel, setShareLabel] = useState("Copiar link público");
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

  async function copiarLinkPublico() {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await fetch("/api/share-link", { method: "POST" });
      if (!res.ok) throw new Error("request failed");
      const { token } = (await res.json()) as { token: string };
      const url = `${window.location.origin}/publico/${token}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // clipboard unavailable — the label below still confirms the link exists
      }
      setShareLabel("Link copiado!");
    } catch {
      setShareLabel("Não foi possível gerar o link");
    } finally {
      setSharing(false);
      window.setTimeout(() => setShareLabel("Copiar link público"), 3000);
    }
  }

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
          <button type="button" className="btn-ghost" onClick={copiarLinkPublico} disabled={sharing}>
            {shareLabel}
          </button>
          <button type="button" className="btn-ghost" onClick={onSignOut}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
