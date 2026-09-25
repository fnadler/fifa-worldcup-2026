"use client";

import { useState, type FormEvent } from "react";
import { parseProfileInput } from "@/lib/profile";
import { maskPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "./BrandLogo";
import { NAME_MAX, PLATFORM_NAME } from "@/lib/brand";

type Mode = "signin" | "signup";

interface LoginFormProps {
  /** Coleções ativas. Com mais de uma, a criação de conta pede para escolher. */
  albums: { id: string; name: string }[];
  /** Aba inicial: /login?modo=cadastro abre direto em "Criar conta". */
  initialMode?: Mode;
  /** Para onde seguir depois de entrar/cadastrar (já validado no servidor). */
  next: string;
}

export default function LoginForm({ albums, initialMode = "signin", next }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [albumId, setAlbumId] = useState(albums.length === 1 ? albums[0].id : "");
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
      window.location.href = next;
      return;
    }

    if (albums.length > 1 && !albumId) {
      setLoading(false);
      setError("Escolha qual coleção você vai montar.");
      return;
    }
    const profile = parseProfileInput(fullName, whatsapp, collectionName);
    if ("error" in profile) {
      setLoading(false);
      setError(profile.error);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: { ...profile.data, ...(albumId ? { album_id: albumId } : {}) }, // vai para o user_metadata
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
    window.location.href = next;
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand">
          <BrandLogo />
          <span className="kicker">Controle de figurinhas</span>
          <span className="title">{PLATFORM_NAME}</span>
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
              {albums.length > 1 && (
                <select
                  required
                  className="login-input login-select"
                  value={albumId}
                  onChange={(e) => setAlbumId(e.target.value)}
                  aria-label="Coleção que você vai montar"
                >
                  <option value="" disabled>
                    Qual coleção você vai montar?
                  </option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
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
              <div className="field-with-counter">
                <input
                  required
                  placeholder="Nome da sua coleção (ex: Coleção do João)"
                  maxLength={NAME_MAX}
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  className="login-input"
                />
                <span className="field-counter">
                  {collectionName.length}/{NAME_MAX}
                </span>
              </div>
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
