"use client";

import { useState, type FormEvent } from "react";
import { parseAccountInput } from "@/lib/profile";
import { maskPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "./marketing/AuthShell";

// "forgot": pede só o e-mail e manda o link para criar uma senha nova.
type Mode = "signin" | "signup" | "forgot";

const HEAD: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Bem-vindo de volta", subtitle: "Entre para abrir a sua coleção." },
  signup: { title: "Crie sua conta grátis", subtitle: "Organize sua coleção e saiba na hora o que falta e o que sobra." },
  forgot: { title: "Esqueceu a senha?", subtitle: "Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova." },
};

/** Tela onde a pessoa escolhe a senha nova, depois de abrir o link do e-mail. */
export const NEW_PASSWORD_PATH = "/login/nova-senha";

interface LoginFormProps {
  /** Aba inicial: /login?modo=cadastro abre direto em "Criar conta". */
  initialMode?: Mode;
  /** Para onde seguir depois de entrar/cadastrar (já validado no servidor). */
  next: string;
  /** Aviso inicial (ex: link de e-mail inválido ou vencido). */
  initialError?: string | null;
}

export default function LoginForm({ initialMode = "signin", next, initialError = null }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(initialError);
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

    if (mode === "forgot") {
      // O link volta por /auth/callback (ou /auth/confirm), que abre a sessão e segue para a tela de senha nova.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(NEW_PASSWORD_PATH)}`,
      });
      setLoading(false);
      if (resetError) {
        setError(
          resetError.status === 429
            ? "Muitos pedidos em pouco tempo. Espere alguns minutos e tente de novo."
            : "Não foi possível enviar o e-mail — tente de novo."
        );
        return;
      }
      // mesma resposta existindo ou não a conta (não revela quem tem cadastro)
      setInfo("Se existir uma conta com esse e-mail, enviamos um link para criar uma senha nova. Confira também a caixa de spam.");
      return;
    }

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

    const profile = parseAccountInput(fullName, whatsapp);
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
        // user_metadata; as coleções são escolhidas depois de confirmar o e-mail (lib/onboarding.ts)
        data: { ...profile.data, onboarding: "pending" },
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
    <AuthShell title={HEAD[mode].title} subtitle={HEAD[mode].subtitle} variant={mode}>
        {mode !== "forgot" && (
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
        )}

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
          {mode !== "forgot" && (
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
          )}
          {mode === "signin" && (
            <button type="button" className="login-link" onClick={() => switchMode("forgot")}>
              Esqueci minha senha
            </button>
          )}
          {error && <div className="login-error">{error}</div>}
          {info && <div className="login-info">{info}</div>}
          <button type="submit" className="mk-btn mk-btn-yellow login-submit" disabled={loading}>
            {loading ? "Aguarde…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
          </button>
          {mode === "forgot" && (
            <button type="button" className="login-link login-link-center" onClick={() => switchMode("signin")}>
              ← Voltar para entrar
            </button>
          )}
        </form>
    </AuthShell>
  );
}
