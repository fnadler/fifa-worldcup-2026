"use client";

import { useState } from "react";
import type { AppUser } from "@/lib/types";

interface AuthBarProps {
  user: AppUser | null;
  onSignIn: (email: string) => Promise<{ error: string | null }>;
  onSignOut: () => void;
}

export default function AuthBar({ user, onSignIn, onSignOut }: AuthBarProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (user) {
    return (
      <div className="auth-bar">
        <span className="auth-status">{user.email}</span>
        <button type="button" className="btn-ghost" onClick={onSignOut}>
          Sair
        </button>
      </div>
    );
  }

  async function enviar() {
    if (!email.trim() || sending) return;
    setSending(true);
    setMessage(null);
    const { error } = await onSignIn(email.trim());
    setSending(false);
    setMessage(error ? "Não foi possível enviar o link — tente de novo." : "Link enviado — confira seu e-mail.");
  }

  return (
    <div className="auth-bar">
      <input
        type="email"
        inputMode="email"
        placeholder="seu@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && enviar()}
        className="auth-email-input"
      />
      <button type="button" className="btn-ghost" onClick={enviar} disabled={sending}>
        {sending ? "Enviando…" : "Entrar"}
      </button>
      {message && <span className="auth-status">{message}</span>}
    </div>
  );
}
