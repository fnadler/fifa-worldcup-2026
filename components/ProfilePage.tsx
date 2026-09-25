"use client";

import { useState, type FormEvent } from "react";
import { parseProfileInput, type ProfileData } from "@/lib/profile";
import { maskPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import { HeaderActions, IconLink, NavSwitch } from "./HeaderIcons";
import UserMenu, { signOut } from "./UserMenu";
import BrandLogo from "./BrandLogo";
import { NAME_MAX, PLATFORM_NAME } from "@/lib/brand";

interface ProfilePageProps {
  email: string | null;
  createdAt: string;
  shopHref: string | null;
  profile: ProfileData;
}

export default function ProfilePage({ email, createdAt, shopHref, profile }: ProfilePageProps) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [whatsapp, setWhatsapp] = useState(maskPhoneBR(profile.whatsapp));
  const [collectionName, setCollectionName] = useState(profile.collection_name);
  const [savingDados, setSavingDados] = useState(false);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const [okDados, setOkDados] = useState(false);

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvarDados(e: FormEvent) {
    e.preventDefault();
    setErroDados(null);
    setOkDados(false);
    const parsed = parseProfileInput(fullName, whatsapp, collectionName);
    if ("error" in parsed) return setErroDados(parsed.error);

    setSavingDados(true);
    const { error } = await createClient().auth.updateUser({ data: parsed.data });
    setSavingDados(false);
    if (error) return setErroDados("Não foi possível salvar — tente de novo.");
    setFullName(parsed.data.full_name);
    setWhatsapp(maskPhoneBR(parsed.data.whatsapp));
    setCollectionName(parsed.data.collection_name);
    setOkDados(true);
  }

  async function alterarSenha(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    if (senha.length < 6) return setErro("A nova senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não conferem.");

    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setSaving(false);
    if (error) {
      setErro(
        error.message.toLowerCase().includes("different")
          ? "A nova senha precisa ser diferente da atual."
          : "Não foi possível alterar a senha — tente de novo."
      );
      return;
    }
    setSenha("");
    setConfirmacao("");
    setOk(true);
  }

  return (
    <div className="app-shell">
      <div className="header">
        <div className="header-inner">
          <div className="header-main-row">
            <div className="brand">
              <BrandLogo />
              <span className="kicker">{PLATFORM_NAME}</span>
              <span className="title">Minha conta</span>
            </div>
            <HeaderActions>
              {shopHref ? <NavSwitch active={null} shopHref={shopHref} /> : <IconLink href="/" icon="album" label="Minha coleção" />}
              <UserMenu email={email} shopSettings={!!shopHref} />
            </HeaderActions>
          </div>
        </div>
      </div>

      <div className="admin-page profile-page">
        <form className="admin-section admin-settings-form" onSubmit={salvarDados}>
          <h2 className="admin-section-title">Dados da conta</h2>
          {(!profile.full_name || !profile.collection_name) && (
            <p className="modal-notice">Complete seu cadastro: nome completo, WhatsApp e o nome da sua coleção.</p>
          )}
          <label className="form-label">
            Nome completo
            <input
              className="login-input"
              autoComplete="name"
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="form-label">
            Nome da coleção{" "}
            <span className="field-hint">
              aparece no topo da sua coleção · {collectionName.length}/{NAME_MAX}
            </span>
            <input
              className="login-input"
              maxLength={NAME_MAX}
              placeholder="Ex: Coleção do João"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label className="form-label">
              WhatsApp
              <input
                className="login-input"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="(11) 99999-8888"
                maxLength={15}
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskPhoneBR(e.target.value))}
              />
            </label>
            <label className="form-label">
              E-mail
              <input className="login-input" value={email ?? ""} readOnly disabled />
            </label>
          </div>
          <span className="cart-note">
            Conta criada em {new Date(createdAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}.
          </span>
          {erroDados && <div className="login-error">{erroDados}</div>}
          {okDados && <div className="login-info">Dados salvos!</div>}
          <div className="modal-actions">
            <button type="submit" className="btn-restore" disabled={savingDados}>
              {savingDados ? "Salvando…" : "Salvar dados"}
            </button>
          </div>
        </form>

        <form className="admin-section" onSubmit={alterarSenha}>
          <h2 className="admin-section-title">Alterar senha</h2>
          <div className="form-row">
            <label className="form-label">
              Nova senha
              <input
                className="login-input"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </label>
            <label className="form-label">
              Confirme a nova senha
              <input
                className="login-input"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </label>
          </div>
          {erro && <div className="login-error">{erro}</div>}
          {ok && <div className="login-info">Senha alterada!</div>}
          <div className="modal-actions">
            <button type="submit" className="btn-restore" disabled={saving || !senha}>
              {saving ? "Salvando…" : "Alterar senha"}
            </button>
          </div>
        </form>

        <section className="admin-section">
          <h2 className="admin-section-title">Sessão</h2>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => void signOut()}>
              Sair da conta
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
