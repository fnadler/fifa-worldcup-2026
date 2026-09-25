"use client";

import { useState } from "react";
import { PLATFORM_NAME } from "@/lib/brand";
import { COLLECTION_PATH } from "@/lib/routes";
import BrandLogo from "./BrandLogo";
import { HeaderActions, IconLink } from "./HeaderIcons";
import UserMenu from "./UserMenu";

interface SubscribePageProps {
  email: string | null;
  /** null = assinaturas ainda não configuradas (sem chaves do Stripe). */
  plan: { price: string; trialDays: number; returning: boolean } | null;
}

const BENEFICIOS = [
  "Sua loja com endereço próprio (/nome-da-sua-loja) e a sua imagem",
  "Catálogo com fotos das suas repetidas, preços por grupo ou por figurinha",
  "Carrinho com reserva, pedido mínimo e pedidos direto no seu WhatsApp",
  "Painel de pedidos: confirmar, editar, dar baixa no estoque automaticamente",
];

export default function SubscribePage({ email, plan }: SubscribePageProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function assinar() {
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
              <UserMenu email={email} />
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
          ) : (
            <p className="modal-notice">As assinaturas da loja estarão disponíveis em breve.</p>
          )}
        </section>
      </div>
    </div>
  );
}
