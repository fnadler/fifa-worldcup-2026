"use client";

import { useState, type FormEvent } from "react";
import { parseProfileInput } from "@/lib/profile";
import { maskPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "./BrandLogo";

type Mode = "signin" | "signup";

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) {
        setError("E-mail ou senha inválidos.");
        return;
      }
      window.location.href = "/";
      return;
    }

    const profile = parseProfileInput(fullName, whatsapp);
    if ("error" in profile) {
      setLoading(false);
      setError(profile.error);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: profile.data, // vai para o user_metadata
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      setInfo("Conta criada — confira seu e-mail para confirmar antes de entrar.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand">
          <BrandLogo />
          <span className="kicker">Controle de repetidas</span>
          <span className="title">Álbum Copa 2026</span>
        </div>

        <div className="segmented login-mode-toggle">
          <button
            type="button"
            className={`chip ${mode === "signin" ? "active" : ""}`}
            onClick={() => switchMode("signin")}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`chip ${mode === "signup" ? "active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={onSubmit} className="login-form">
          {mode === "signup" && (
            <>
              <input
                required
                autoComplete="name"
                placeholder="Nome completo"
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="login-input"
              />
              <input
                type="tel"
                required
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="WhatsApp (11) 99999-8888"
                maxLength={15}
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskPhoneBR(e.target.value))}
                className="login-input"
              />
            </>
          )}
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />
          {error && <div className="login-error">{error}</div>}
          {info && <div className="login-info">{info}</div>}
          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}
