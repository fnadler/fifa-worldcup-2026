"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { parseAccountInput, parseCollectionName, type ProfileData } from "@/lib/profile";
import { maskPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import AccountHeader from "./AccountHeader";
import { signOut } from "./UserMenu";
import { NAME_MAX } from "@/lib/brand";
import type { UserCollection } from "@/lib/userCollections";

interface ProfilePageProps {
  email: string | null;
  createdAt: string;
  shop: { href: string; active: boolean };
  profile: ProfileData;
  userId: string;
  /** Coleções da pessoa, cada uma com o nome que ela deu. */
  collections: UserCollection[];
}

export default function ProfilePage({ email, createdAt, shop, profile, userId, collections }: ProfilePageProps) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [whatsapp, setWhatsapp] = useState(maskPhoneBR(profile.whatsapp));
  const [savingDados, setSavingDados] = useState(false);
  const [erroDados, setErroDados] = useState<string | null>(null);
  const [okDados, setOkDados] = useState(false);

  const [nomes, setNomes] = useState<Record<string, string>>(() =>
    Object.fromEntries(collections.map((c) => [c.albumId, c.collectionName]))
  );
  const [salvos, setSalvos] = useState(nomes);
  const [savingNomes, setSavingNomes] = useState(false);
  const [erroNomes, setErroNomes] = useState<string | null>(null);
  const [okNomes, setOkNomes] = useState(false);

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvarDados(e: FormEvent) {
    e.preventDefault();
    setErroDados(null);
    setOkDados(false);
    const parsed = parseAccountInput(fullName, whatsapp);
    if ("error" in parsed) return setErroDados(parsed.error);

    setSavingDados(true);
    const { error } = await createClient().auth.updateUser({ data: parsed.data });
    setSavingDados(false);
    if (error) return setErroDados("Não foi possível salvar — tente de novo.");
    setFullName(parsed.data.full_name);
    setWhatsapp(maskPhoneBR(parsed.data.whatsapp));
    setOkDados(true);
  }

  async function salvarNomes(e: FormEvent) {
    e.preventDefault();
    setErroNomes(null);
    setOkNomes(false);
    const limpos: Record<string, string> = {};
    for (const c of collections) {
      const parsed = parseCollectionName(nomes[c.albumId] ?? "");
      if ("error" in parsed) return setErroNomes(`${c.albumName}: ${parsed.error}`);
      limpos[c.albumId] = parsed.name;
    }
    const mudaram = collections.filter((c) => limpos[c.albumId] !== salvos[c.albumId]);
    if (!mudaram.length) return setOkNomes(true);

    setSavingNomes(true);
    const supabase = createClient();
    const results = await Promise.all(
      mudaram.map((c) =>
        supabase
          .from("user_albums")
          .update({ collection_name: limpos[c.albumId] })
          .eq("user_id", userId)
          .eq("album_id", c.albumId)
      )
    );
    setSavingNomes(false);
    if (results.some((r) => r.error)) return setErroNomes("Não foi possível salvar — tente de novo.");
    setNomes(limpos);
    setSalvos(limpos);
    setOkNomes(true);
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
      <AccountHeader title="Minha conta" email={email} shop={shop} />

      <div className="admin-page profile-page">
        <form className="admin-section admin-settings-form" onSubmit={salvarDados}>
          <h2 className="admin-section-title">Dados da conta</h2>
          {(!profile.full_name || !profile.whatsapp) && (
            <p className="modal-notice">Complete seu cadastro: nome completo e WhatsApp.</p>
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

        <form className="admin-section admin-settings-form" onSubmit={salvarNomes}>
          <h2 className="admin-section-title">Minhas coleções</h2>
          <p className="modal-notice">O nome aparece no topo de cada coleção e no link público dela.</p>
          {collections.map((c) => (
            <label key={c.albumId} className="form-label">
              <span className="collection-name-label">
                {c.albumName}
                <Link href={`/colecao/${c.slug}`} className="field-hint">
                  abrir
                </Link>
              </span>
              <span className="field-hint">{(nomes[c.albumId] ?? "").length}/{NAME_MAX}</span>
              <input
                className="login-input"
                maxLength={NAME_MAX}
                placeholder="Ex: Coleção do João"
                value={nomes[c.albumId] ?? ""}
                onChange={(e) => setNomes((n) => ({ ...n, [c.albumId]: e.target.value }))}
              />
            </label>
          ))}
          {erroNomes && <div className="login-error">{erroNomes}</div>}
          {okNomes && <div className="login-info">Nomes salvos!</div>}
          <div className="modal-actions">
            <Link href="/colecoes" className="btn-ghost">
              + Adicionar coleção
            </Link>
            <button type="submit" className="btn-restore" disabled={savingNomes}>
              {savingNomes ? "Salvando…" : "Salvar nomes"}
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
