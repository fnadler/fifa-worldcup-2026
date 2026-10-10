"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parseAccountInput } from "@/lib/profile";
import { maskPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "./marketing/AuthShell";

// "forgot": pede só o e-mail e manda o link para criar uma senha nova.
// "confirm": conta criada, aguardando a pessoa abrir o link de confirmação que foi por e-mail.
type Mode = "signin" | "signup" | "forgot" | "confirm";

const HEAD: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Bem-vindo de volta", subtitle: "Entre para abrir a sua coleção." },
  signup: { title: "Crie sua conta grátis", subtitle: "Organize sua coleção e saiba na hora o que falta e o que sobra." },
  forgot: { title: "Esqueceu a senha?", subtitle: "Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova." },
  confirm: { title: "Confirme seu e-mail", subtitle: "Falta só um passo para abrir a sua coleção." },
};

// Espera entre um pedido de reenvio e o próximo: cresce a cada pedido. O Supabase também limita
// do lado dele; este controle evita o clique repetido e mostra o tempo que falta.
const RESEND_WAIT = [60, 120, 300];
const resendKey = (email: string) => `gn_reenvio:${email.toLowerCase()}`;

function readResend(email: string): { at: number; n: number } {
  try {
    const v = JSON.parse(sessionStorage.getItem(resendKey(email)) ?? "null") as { at?: unknown; n?: unknown } | null;
    if (v && typeof v.at === "number" && typeof v.n === "number") return { at: v.at, n: v.n };
  } catch {}
  return { at: 0, n: 0 };
}

function writeResend(email: string, v: { at: number; n: number }) {
  try {
    sessionStorage.setItem(resendKey(email), JSON.stringify(v));
  } catch {}
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Tela onde a pessoa escolhe a senha nova, depois de abrir o link do e-mail. */
export const NEW_PASSWORD_PATH = "/login/nova-senha";

interface LoginFormProps {
  /** Aba inicial: /login?modo=cadastro abre direto em "Criar conta". */
  initialMode?: Exclude<Mode, "confirm">;
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
  // tela de confirmação: quando o próximo reenvio é permitido, quantos já foram pedidos, e o relógio
  const [resend, setResend] = useState({ at: 0, n: 0 });
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (mode !== "confirm") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const falta = Math.max(0, Math.ceil((resend.at - now) / 1000));

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  /** Abre a tela "confirme seu e-mail". `sent`: um e-mail acabou de sair (começa a contar a espera). */
  function awaitConfirmation(sent: boolean) {
    const t = Date.now();
    const saved = readResend(email);
    const next = sent ? { at: t + RESEND_WAIT[0] * 1000, n: Math.max(saved.n, 1) } : saved;
    if (sent) writeResend(email, next);
    setResend(next);
    setNow(t);
    switchMode("confirm");
  }

  async function reenviar() {
    if (falta > 0 || loading) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: resendError } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    const t = Date.now();
    const wait = RESEND_WAIT[Math.min(resend.n, RESEND_WAIT.length - 1)];
    const prox = { at: t + wait * 1000, n: resend.n + 1 };
    writeResend(email, prox);
    setResend(prox);
    setNow(t);
    if (resendError) {
      setError(
        resendError.status === 429
          ? "Muitos pedidos em pouco tempo. Espere alguns minutos antes de pedir de novo."
          : "Não foi possível reenviar o e-mail — tente de novo em instantes."
      );
      return;
    }
    setInfo("E-mail reenviado. Confira a caixa de entrada e também a de spam.");
  }

  // E-mail digitado errado: volta ao cadastro com os outros dados preenchidos para criar a conta com o
  // endereço certo (a conta do endereço errado nunca é confirmada e não dá acesso a nada).
  function trocarEmail() {
    setEmail("");
    switchMode("signup");
    setInfo("Informe o e-mail correto. Vamos enviar um novo link de confirmação para ele.");
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
        // senha certa, mas o e-mail ainda não foi confirmado: mostra a tela de confirmação
        if (signInError.code === "email_not_confirmed") return awaitConfirmation(false);
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
      setError(
        signUpError.status === 429
          ? "Muitos cadastros em pouco tempo. Espere alguns minutos e tente de novo."
          : signUpError.code === "weak_password"
            ? "Senha fraca — use pelo menos 6 caracteres."
            : "Não foi possível criar a conta — confira os dados e tente de novo."
      );
      return;
    }
    if (!data.session) {
      // e-mail que já tem conta confirmada: o Supabase responde sem sessão e sem identidades (e não envia nada)
      if (data.user && data.user.identities?.length === 0) {
        setError("Já existe uma conta com esse e-mail. Entre com a sua senha ou use “Esqueci minha senha”.");
        return;
      }
      // só segue para a coleção depois de abrir o link de confirmação
      return awaitConfirmation(true);
    }
    window.location.href = next;
  }

  if (mode === "confirm") {
    return (
      <AuthShell title={HEAD.confirm.title} subtitle={HEAD.confirm.subtitle} variant="signup">
        <div className="login-form login-confirm">
          <p>
            Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail e toque em{" "}
            <strong>Confirmar meu e-mail</strong> para continuar o cadastro e escolher as suas coleções.
          </p>
          <p className="login-confirm-hint">Não chegou? Confira a caixa de spam ou peça um novo envio.</p>
          {error && <div className="login-error">{error}</div>}
          {info && <div className="login-info">{info}</div>}
          <button type="button" className="mk-btn mk-btn-yellow login-submit" onClick={reenviar} disabled={loading || falta > 0}>
            {loading ? "Enviando…" : falta > 0 ? `Reenviar e-mail em ${mmss(falta)}` : "Reenviar e-mail de confirmação"}
          </button>
          <button type="button" className="mk-btn mk-btn-ghost-green login-submit" onClick={trocarEmail} disabled={loading}>
            Trocar o e-mail
          </button>
          <button type="button" className="login-link login-link-center" onClick={() => switchMode("signin")}>
            Já confirmei — entrar
          </button>
        </div>
      </AuthShell>
    );
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
