"use client";

import { useState, type FormEvent } from "react";
import { parseProfileInput, type ProfileData } from "@/lib/profile";
import { maskPhoneBR } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { HeaderActions, NavSwitch } from "./HeaderIcons";
import UserMenu, { signOut } from "./UserMenu";
import BrandLogo from "./BrandLogo";
import { NAME_MAX, PLATFORM_NAME } from "@/lib/brand";

interface ProfilePageProps {
  email: string | null;
  createdAt: string;
  shop: { href: string; active: boolean };
  subscription: SubscriptionInfo | null;
  /** Acesso à loja concedido manualmente (ex: dono/cortesia), independente do Stripe. */
  manualAccess: boolean;
  profile: ProfileData;
  /** Nome da coleção (álbum) que a pessoa monta. */
  albumName: string | null;
}

interface SubscriptionInfo {
  stripe_customer_id: string | null;
  status: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  access_until: string | null;
}

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";

function descreverAssinatura(s: SubscriptionInfo | null, ativa: boolean, manual: boolean): string {
  if (manual && ativa) return "Acesso à loja liberado (cortesia).";
  if (!s?.status) return "Você ainda não assina a loja.";
  switch (s.status) {
    case "trialing":
      return s.cancel_at_period_end
        ? `Teste grátis até ${dataBR(s.trial_end)} — cancelamento agendado, não haverá cobrança.`
        : `Teste grátis até ${dataBR(s.trial_end)}. A primeira cobrança acontece nessa data.`;
    case "active":
      return s.cancel_at_period_end
        ? `Assinatura cancelada — a loja fica disponível até ${dataBR(s.current_period_end)}.`
        : `Assinatura ativa. Próxima cobrança em ${dataBR(s.current_period_end)}.`;
    case "past_due":
      return `Não conseguimos cobrar seu cartão. Atualize o pagamento — a loja fica disponível até ${dataBR(s.access_until)}.`;
    default:
      return "Sua assinatura foi encerrada. Assine novamente para reabrir a loja.";
  }
}

export default function ProfilePage({ email, createdAt, shop, subscription, manualAccess, profile, albumName }: ProfilePageProps) {
  const [abrindoPortal, setAbrindoPortal] = useState(false);
  const [erroPortal, setErroPortal] = useState<string | null>(null);

  async function abrirPortal() {
    setAbrindoPortal(true);
    setErroPortal(null);
    try {
      const res = await fetch("/api/assinatura/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Não foi possível abrir o portal.");
      window.location.assign(data.url);
    } catch (e) {
      setErroPortal(e instanceof Error ? e.message : "Não foi possível abrir o portal.");
      setAbrindoPortal(false);
    }
  }

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
              <NavSwitch active={null} shopHref={shop.href} />
              <UserMenu email={email} shopSettings={shop.active} />
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
            {albumName && <>Álbum: {albumName} · </>}
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
          <h2 className="admin-section-title">Assinatura da loja</h2>
          <p className="modal-notice">{descreverAssinatura(subscription, shop.active, manualAccess)}</p>
          {erroPortal && <div className="login-error">{erroPortal}</div>}
          <div className="modal-actions">
            {subscription?.stripe_customer_id && subscription.status && (
              <button type="button" className="btn-ghost" onClick={() => void abrirPortal()} disabled={abrindoPortal}>
                {abrindoPortal ? "Abrindo…" : "Gerenciar assinatura"}
              </button>
            )}
            {!shop.active && (
              <Link href="/assinar" className="btn-primary">
                {subscription?.status ? "Assinar novamente" : "Assinar a loja"}
              </Link>
            )}
          </div>
        </section>

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
