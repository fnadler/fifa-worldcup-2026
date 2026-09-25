"use client";

import { useEffect, useState, type FormEvent } from "react";
import { describeSticker, formatBRL, formatDateTimeBR, type BuyerInfo } from "@/lib/shop";

export interface CartLine {
  code: string;
  qty: number;
  available: number;
  unitCents: number;
}

interface CartModalProps {
  token: string;
  lines: CartLine[];
  totalCents: number;
  minOrderCents: number;
  onChange: (code: string, delta: number) => void;
  onRemove: (code: string) => void;
  onUnavailable: (codes: string[]) => void;
  onOrdered: () => void;
  onClose: () => void;
}

const BUYER_KEY = "copa2026-buyer-v1";

const EMPTY_BUYER: BuyerInfo = {
  name: "",
  email: "",
  whatsapp: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

type Step = "cart" | "checkout" | "done";

export default function CartModal({
  token,
  lines,
  totalCents,
  minOrderCents,
  onChange,
  onRemove,
  onUnavailable,
  onOrdered,
  onClose,
}: CartModalProps) {
  const [step, setStep] = useState<Step>("cart");
  const [buyer, setBuyer] = useState<BuyerInfo>(EMPTY_BUYER);
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ number: number; whatsappUrl: string; reservedUntil?: string } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BUYER_KEY);
      if (raw) queueMicrotask(() => setBuyer({ ...EMPTY_BUYER, ...(JSON.parse(raw) as Partial<BuyerInfo>) }));
    } catch {
      // sem dados salvos — o formulário começa vazio
    }
  }, []);

  const totalFigurinhas = lines.reduce((s, l) => s + l.qty, 0);
  const faltaParaMinimo = Math.max(minOrderCents - totalCents, 0);

  function field(key: keyof BuyerInfo) {
    return {
      value: buyer[key],
      onChange: (e: { target: { value: string } }) => setBuyer((b) => ({ ...b, [key]: e.target.value })),
    };
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      try {
        window.localStorage.setItem(BUYER_KEY, JSON.stringify(buyer));
      } catch {
        // conveniência apenas
      }
      const res = await fetch(`/api/loja/${token}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ code: l.code, qty: l.qty })),
          buyer,
          website: honeypot,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        unavailable?: string[];
        number?: number;
        whatsappUrl?: string;
        reservedUntil?: string;
      };
      if (!res.ok || !data.number || !data.whatsappUrl) {
        if (data.unavailable?.length) {
          onUnavailable(data.unavailable);
          setStep("cart");
        }
        setError(data.error ?? "Não foi possível registrar o pedido — tente de novo.");
        return;
      }
      setResult({ number: data.number, whatsappUrl: data.whatsappUrl, reservedUntil: data.reservedUntil });
      setStep("done");
      onOrdered();
    } catch {
      setError("Sem conexão — verifique sua internet e tente de novo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Carrinho">
      <div className="modal-card cart-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {step === "cart" ? "Carrinho" : step === "checkout" ? "Seus dados" : "Pedido registrado"}
          </span>
          {step !== "done" && (
            <span className="modal-count">
              {totalFigurinhas} figurinha{totalFigurinhas === 1 ? "" : "s"}
            </span>
          )}
          <div className="modal-header-spacer" />
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {step === "cart" && (
          <>
            <div className="cart-body">
              {error && <div className="login-error">{error}</div>}
              {lines.length === 0 && <div className="empty-message">Seu carrinho está vazio.</div>}
              {lines.map((l) => (
                <div key={l.code} className="cart-line">
                  <div className="cart-line-info">
                    <span className="cart-line-code">{l.code}</span>
                    <span className="cart-line-meta">
                      {describeSticker(l.code)} · {formatBRL(l.unitCents)} cada
                    </span>
                  </div>
                  <div className="stepper">
                    <button type="button" onClick={() => onChange(l.code, -1)} disabled={l.qty <= 1} aria-label="Diminuir">
                      −
                    </button>
                    <span>{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => onChange(l.code, 1)}
                      disabled={l.qty >= l.available}
                      aria-label="Aumentar"
                    >
                      +
                    </button>
                  </div>
                  <span className="cart-line-total">{formatBRL(l.qty * l.unitCents)}</span>
                  <button type="button" className="cart-line-remove" onClick={() => onRemove(l.code)} aria-label={`Remover ${l.code}`}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div className="cart-total-row">
                <span>Total</span>
                <span className="cart-total-value">{formatBRL(totalCents)}</span>
              </div>
              <span className="cart-note">Frete a combinar com o vendedor pelo WhatsApp.</span>
              {faltaParaMinimo > 0 && lines.length > 0 && (
                <span className="cart-warning">
                  Pedido mínimo de {formatBRL(minOrderCents)} — faltam {formatBRL(faltaParaMinimo)}.
                </span>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={lines.length === 0 || faltaParaMinimo > 0}
                onClick={() => {
                  setError(null);
                  setStep("checkout");
                }}
              >
                Fechar pedido
              </button>
            </div>
          </>
        )}

        {step === "checkout" && (
          <form className="cart-body checkout-form" onSubmit={enviar}>
            <label className="form-label">
              Nome completo
              <input className="login-input" required autoComplete="name" {...field("name")} />
            </label>
            <div className="form-row">
              <label className="form-label">
                E-mail
                <input className="login-input" type="email" required autoComplete="email" {...field("email")} />
              </label>
              <label className="form-label">
                WhatsApp (com DDD)
                <input
                  className="login-input"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="(11) 99999-8888"
                  {...field("whatsapp")}
                />
              </label>
            </div>
            <div className="form-row">
              <label className="form-label form-narrow">
                CEP
                <input className="login-input" required inputMode="numeric" autoComplete="postal-code" {...field("cep")} />
              </label>
              <label className="form-label">
                Rua / Avenida
                <input className="login-input" required autoComplete="address-line1" {...field("street")} />
              </label>
            </div>
            <div className="form-row">
              <label className="form-label form-narrow">
                Número
                <input className="login-input" required {...field("number")} />
              </label>
              <label className="form-label">
                Complemento (opcional)
                <input className="login-input" autoComplete="address-line2" {...field("complement")} />
              </label>
            </div>
            <div className="form-row">
              <label className="form-label">
                Bairro
                <input className="login-input" required {...field("district")} />
              </label>
              <label className="form-label">
                Cidade
                <input className="login-input" required autoComplete="address-level2" {...field("city")} />
              </label>
              <label className="form-label form-tiny">
                UF
                <input className="login-input" required maxLength={2} autoComplete="address-level1" {...field("state")} />
              </label>
            </div>
            <input
              className="honeypot"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />

            {error && <div className="login-error">{error}</div>}

            <div className="cart-total-row">
              <span>Total</span>
              <span className="cart-total-value">{formatBRL(totalCents)}</span>
            </div>
            <span className="cart-note">
              Nenhum pagamento é feito pelo site. Ao confirmar, você envia o pedido pelo WhatsApp e combina pagamento e
              frete diretamente por lá.
            </span>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setStep("cart")}>
                Voltar
              </button>
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? "Registrando…" : "Confirmar pedido"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && result && (
          <div className="cart-body cart-done">
            <span className="cart-done-number">#{result.number}</span>
            <p className="modal-notice">
              Seu pedido foi registrado. <strong>Agora envie-o pelo WhatsApp</strong> para o vendedor — é por lá que vocês
              combinam pagamento e entrega.
            </p>
            {result.reservedUntil && (
              <p className="modal-notice">
                As figurinhas ficam reservadas para você até <strong>{formatDateTimeBR(result.reservedUntil)}</strong>. Sem
                confirmação do vendedor até lá, o pedido é cancelado.
              </p>
            )}
            <a className="btn-restore btn-whatsapp" href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
              Enviar pedido pelo WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
