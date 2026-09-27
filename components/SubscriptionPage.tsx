"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AccountHeader from "./AccountHeader";

export interface SubscriptionInfo {
  stripe_customer_id: string | null;
  status: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  access_until: string | null;
}

interface SubscriptionPageProps {
  email: string | null;
  shop: { href: string; active: boolean };
  subscription: SubscriptionInfo | null;
  /** Acesso à loja concedido manualmente (ex: dono/cortesia), independente do Stripe. */
  manualAccess: boolean;
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

export default function SubscriptionPage({ email, shop, subscription, manualAccess }: SubscriptionPageProps) {
  const router = useRouter();
  const [abrindoPortal, setAbrindoPortal] = useState(false);
  const [erroPortal, setErroPortal] = useState<string | null>(null);

  async function abrirPortal() {
    setAbrindoPortal(true);
    setErroPortal(null);
    try {
      const res = await fetch("/api/assinatura/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; stale?: boolean };
      if (data.stale) {
        // vínculo com o Stripe foi limpo no servidor: recarrega os dados para oferecer "Assinar"
        setErroPortal(data.error ?? null);
        setAbrindoPortal(false);
        router.refresh();
        return;
      }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Não foi possível abrir o portal.");
      window.location.assign(data.url);
    } catch (e) {
      setErroPortal(e instanceof Error ? e.message : "Não foi possível abrir o portal.");
      setAbrindoPortal(false);
    }
  }

  return (
    <div className="app-shell">
      <AccountHeader title="Assinatura" email={email} shop={shop} />
      <div className="admin-page profile-page">
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
                {subscription?.status ? "Assinar novamente" : "Assine já"}
              </Link>
            )}
          </div>
          {subscription?.stripe_customer_id && subscription.status && (
            <span className="cart-note">
              Em “Gerenciar assinatura” você troca o cartão, vê as faturas e cancela quando quiser.
            </span>
          )}
        </section>
      </div>
    </div>
  );
}
