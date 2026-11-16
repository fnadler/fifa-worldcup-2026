"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PLATFORM_NAME } from "@/lib/brand";
import { trackWithServer } from "@/lib/metaClient";
import { COLLECTION_PATH } from "@/lib/routes";
import BrandLogo from "./BrandLogo";
import { HeaderActions, IconLink } from "./HeaderIcons";
import UserMenu from "./UserMenu";

interface SubscribePageProps {
  email: string | null;
  /** null = assinaturas ainda não configuradas (sem chaves do Stripe). */
  plan: { price: string; trialDays: number; returning: boolean } | null;
  /** O e-mail ainda não foi confirmado (cadastro sem confirmação): pede o código antes do pagamento. */
  verificarEmail: boolean;
}

const BENEFICIOS = [
  "Sua loja com endereço próprio (/nome-da-sua-loja) e a sua imagem",
  "Catálogo com fotos das suas repetidas, em várias coleções, com preços por grupo ou por item",
  "Carrinho com reserva, pedido mínimo e pedidos direto no seu WhatsApp",
  "Painel de pedidos: confirmar, editar, dar baixa no estoque automaticamente",
];

export default function SubscribePage({ email, plan, verificarEmail }: SubscribePageProps) {
  const [confirmado, setConfirmado] = useState(!verificarEmail);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const viewed = useRef(false); // StrictMode roda o efeito duas vezes em dev
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackWithServer("ViewContent", { content_name: "Assinatura da Loja" });
  }, []);

  async function assinar() {
    trackWithServer("InitiateCheckout", { content_name: "Assinatura da Loja", currency: "BRL" });
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/assinatura/checkout", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Não foi possível iniciar a assinatura.");
      window.location.assign(data.url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar a assinatura.");
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="header">
        <div className="header-inner">
          <div className="header-main-row">
            <div className="brand">
              <BrandLogo />
              <span className="kicker">{PLATFORM_NAME}</span>
              <span className="title">Sua loja</span>
            </div>
            <HeaderActions>
              <IconLink href={COLLECTION_PATH} icon="album" label="Minha coleção" />
              <UserMenu email={email} shopActive={false} />
            </HeaderActions>
          </div>
        </div>
      </div>

      <div className="admin-page subscribe-page">
        <section className="admin-section subscribe-card">
          <span className="kicker">Loja {PLATFORM_NAME}</span>
          <h1 className="subscribe-title">Venda suas repetidas</h1>
          <ul className="subscribe-benefits">
            {BENEFICIOS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>

          {plan ? (
            <>
              <div className="subscribe-price">
                <span className="subscribe-price-value">{plan.price}</span>
                <span className="subscribe-price-period">/mês</span>
              </div>
              {plan.trialDays > 0 ? (
                <p className="modal-notice">
                  <strong>{plan.trialDays} dias grátis.</strong> Você cadastra o cartão agora e só é cobrado depois do
                  teste. Cancele quando quiser, sem multa.
                </p>
              ) : (
                <p className="modal-notice">Cobrança mensal no cartão de crédito. Cancele quando quiser, sem multa.</p>
              )}
              {!confirmado ? (
                <ConfirmarEmail email={email} onConfirmado={() => setConfirmado(true)} />
              ) : (
              <>
              {erro && <div className="login-error">{erro}</div>}
              <button type="button" className="btn-primary subscribe-cta" onClick={() => void assinar()} disabled={loading}>
                {loading
                  ? "Abrindo pagamento…"
                  : plan.trialDays > 0
                    ? `Começar ${plan.trialDays} dias grátis`
                    : plan.returning
                      ? "Reativar assinatura"
                      : "Assinar agora"}
              </button>
              <span className="cart-note">Pagamento seguro processado pelo Stripe. Não guardamos dados do seu cartão.</span>
              </>
              )}
            </>
          ) : (
            <p className="modal-notice">As assinaturas da loja estarão disponíveis em breve.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Confirmação do e-mail antes do teste grátis: manda um código de 6 dígitos e confere aqui mesmo, sem sair
 * da tela (no navegador do Instagram, um link de confirmação abriria em outro app e perderia o caminho).
 */
function ConfirmarEmail({ email, onConfirmado }: { email: string | null; onConfirmado: () => void }) {
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function chamar(caminho: string, corpo?: object) {
    setOcupado(true);
    setErro(null);
    setInfo(null);
    try {
      const res = await fetch(caminho, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo ?? {}) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; erro?: string; mensagem?: string };
      if (!data.ok) setErro(data.erro ?? "Não foi possível agora — tente de novo.");
      return data;
    } catch {
      setErro("Sem conexão — tente de novo.");
      return { ok: false };
    } finally {
      setOcupado(false);
    }
  }

  async function pedir() {
    const r = await chamar("/api/email/codigo");
    if (r.ok) {
      setEnviado(true);
      setInfo(r.mensagem ?? "Código enviado.");
    }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    const r = await chamar("/api/email/verificar", { codigo });
    if (r.ok) onConfirmado();
  }

  return (
    <div className="verify-email">
      <p className="modal-notice">
        <strong>Antes de ativar, confirme o seu e-mail.</strong> É para lá que vão os avisos da loja e os recibos do
        pagamento{email ? <> (<strong>{email}</strong>)</> : null}.
      </p>
      {enviado ? (
        <form className="verify-email-form" onSubmit={(e) => void confirmar(e)}>
          <input
            className="login-input verify-email-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="Código de 6 números"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-label="Código de confirmação"
          />
          <button type="submit" className="btn-primary subscribe-cta" disabled={ocupado || codigo.length !== 6}>
            {ocupado ? "Conferindo…" : "Confirmar e-mail"}
          </button>
          <button type="button" className="link-button" onClick={() => void pedir()} disabled={ocupado}>
            Não chegou? Enviar outro código
          </button>
        </form>
      ) : (
        <button type="button" className="btn-primary subscribe-cta" onClick={() => void pedir()} disabled={ocupado}>
          {ocupado ? "Enviando…" : "Enviar código para o meu e-mail"}
        </button>
      )}
      {info && !erro && <div className="login-info">{info}</div>}
      {erro && <div className="login-error">{erro}</div>}
      <span className="cart-note">E-mail digitado errado? Fale com a gente pelo WhatsApp da comunidade que ajustamos.</span>
    </div>
  );
}
