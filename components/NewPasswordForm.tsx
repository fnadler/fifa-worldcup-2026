"use client";

import { useState, type FormEvent } from "react";
import { COLLECTION_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "./marketing/AuthShell";

// Senha nova depois do link de recuperação (a pessoa já está com a sessão aberta pelo link).
export default function NewPasswordForm({ email }: { email: string | null }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não conferem.");

    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setSaving(false);
    if (error) {
      setErro(
        error.message.toLowerCase().includes("different")
          ? "A nova senha precisa ser diferente da anterior."
          : "Não foi possível salvar a senha — tente de novo."
      );
      return;
    }
    setOk(true);
    window.setTimeout(() => {
      window.location.href = COLLECTION_PATH;
    }, 1500);
  }

  return (
    <AuthShell title="Crie uma senha nova" subtitle={email ? `Conta: ${email}` : "Escolha a senha que você vai usar para entrar."}>
        <form onSubmit={salvar} className="login-form">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Nova senha (mínimo 6 caracteres)"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="login-input"
            disabled={ok}
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Repita a nova senha"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="login-input"
            disabled={ok}
          />
          {erro && <div className="login-error">{erro}</div>}
          {ok && <div className="login-info">Senha alterada! Abrindo a sua coleção…</div>}
          <button type="submit" className="mk-btn mk-btn-yellow login-submit" disabled={saving || ok}>
            {saving ? "Salvando…" : "Salvar senha"}
          </button>
        </form>
    </AuthShell>
  );
}
