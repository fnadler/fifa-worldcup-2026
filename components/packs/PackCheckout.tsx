"use client";

import { useEffect, useState, type FormEvent } from "react";
import { isValidCPF, maskCPF } from "@/lib/cpf";
import { formatBRL, formatDateTimeBR, isValidPhoneBR, maskPhoneBR, type BuyerInfo } from "@/lib/shop";
import SafetyTips from "../SafetyTips";

// Checkout dos pacotes: números escolhidos, dados de contato e endereço, e o pedido pronto para enviar
// no WhatsApp da loja. Mesmos campos (e mesmos dados salvos no navegador) do carrinho da loja.

const BUYER_KEY = "copa2026-buyer-v1";
const EMPTY: BuyerInfo = { name: "", email: "", whatsapp: "", cpf: "", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" };
const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  lotId: string;
  numbers: number[];
  priceCents: number;
  minOrderCents: number;
  shopName: string;
  onClose: () => void;
  onTaken: (taken: number[]) => void;
  onOrdered: () => void;
}

export default function PackCheckout({ lotId, numbers, priceCents, minOrderCents, shopName, onClose, onTaken, onOrdered }: Props) {
  const [buyer, setBuyer] = useState<BuyerInfo>(EMPTY);
  const [honeypot, setHoneypot] = useState("");
  const [ciente, setCiente] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nums, setNums] = useState(numbers);
  const [done, setDone] = useState<{ code: string; numbers: number[]; reservedUntil: string; whatsappUrl: string } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(BUYER_KEY);
      if (raw) {
        const saved = { ...EMPTY, ...(JSON.parse(raw) as Partial<BuyerInfo>) };
        queueMicrotask(() => setBuyer({ ...saved, whatsapp: maskPhoneBR(saved.whatsapp), cpf: maskCPF(saved.cpf) }));
      }
    } catch {
      // sem dados salvos
    }
  }, []);

  const total = nums.length * priceCents;
  const falta = Math.max(minOrderCents - total, 0);
  const field = (k: keyof BuyerInfo) => ({
    value: buyer[k],
    onChange: (e: { target: { value: string } }) => setBuyer((b) => ({ ...b, [k]: e.target.value })),
  });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!isValidPhoneBR(buyer.whatsapp)) return setError("WhatsApp inválido. Informe o DDD e o número: (11) 99999-8888.");
    if (!isValidCPF(buyer.cpf)) return setError("CPF inválido. Confira os números.");
    setSending(true);
    setError(null);
    try {
      try {
        window.localStorage.setItem(BUYER_KEY, JSON.stringify(buyer));
      } catch {
        // conveniência apenas
      }
      const res = await fetch(`/api/pacotes/${lotId}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: nums, buyer, website: honeypot, ack: ciente }),
      });
      const data = (await res.json()) as {
        error?: string;
        taken?: number[];
        code?: string;
        numbers?: number[];
        reservedUntil?: string;
        whatsappUrl?: string;
      };
      if (!res.ok || !data.code || !data.whatsappUrl) {
        if (data.taken?.length) {
          const rest = nums.filter((n) => !data.taken!.includes(n));
          setNums(rest);
          onTaken(data.taken);
          setError(
            `${data.error ?? "Alguns pacotes foram reservados por outras pessoas."} ${
              rest.length ? `Tiramos o${data.taken.length > 1 ? "s" : ""} nº ${data.taken.map(pad).join(", ")} do seu pedido.` : "Escolha outros números."
            }`
          );
          return;
        }
        return setError(data.error ?? "Não foi possível registrar o pedido — tente de novo.");
      }
      setDone({ code: data.code, numbers: data.numbers ?? nums, reservedUntil: data.reservedUntil ?? "", whatsappUrl: data.whatsappUrl });
      onOrdered();
    } catch {
      setError("Sem conexão — verifique sua internet e tente de novo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="lotp-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Seu pedido">
      <div className="lotp-sheet" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <div className="lotp-eyebrow">Pedido #{done.code}</div>
            <h3>Pacotes reservados!</h3>
            <div className="lotp-nums">
              {done.numbers.map((n) => (
                <span key={n}>{pad(n)}</span>
              ))}
            </div>
            <p className="lotp-muted">
              Seus pacotes ficam reservados até <b>{formatDateTimeBR(done.reservedUntil)}</b>. <b>Agora envie o pedido pelo WhatsApp</b>: a
              loja {shopName} responde com os dados do Pix e combina o frete.
            </p>
            <a className="lotp-btn lotp-btn-green" href={done.whatsappUrl} target="_blank" rel="noopener noreferrer">
              Enviar pedido pelo WhatsApp
            </a>
            <div className="lotp-info">
              Quando o pagamento for confirmado, você recebe por e-mail e WhatsApp o link para abrir seus pacotes e descobrir suas Legends.
            </div>
            <button className="lotp-btn lotp-btn-ghost" onClick={onClose}>
              Voltar à grade
            </button>
          </>
        ) : (
          <form onSubmit={enviar} className="lotp-form">
            <h3>Seu pedido</h3>
            <div className="lotp-nums">
              {nums.map((n) => (
                <span key={n}>{pad(n)}</span>
              ))}
            </div>
            <div className="lotp-row">
              <span>
                {nums.length} × Pacote Legends
              </span>
              <span>{formatBRL(total)}</span>
            </div>
            <div className="lotp-row">
              <span>Frete</span>
              <span className="lotp-muted">a combinar no WhatsApp</span>
            </div>
            <div className="lotp-row is-total">
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </div>
            {falta > 0 && (
              <div className="lotp-info">
                O pedido mínimo é de {formatBRL(minOrderCents)}. Faltam {formatBRL(falta)}: escolha mais pacotes.
              </div>
            )}
            <div className="lotp-fields">
              <label className="full">
                Nome completo
                <input required autoComplete="name" {...field("name")} />
              </label>
              <label className="full">
                E-mail
                <input type="email" required autoComplete="email" {...field("email")} />
              </label>
              <label>
                WhatsApp (com DDD)
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="(11) 99999-8888"
                  maxLength={15}
                  value={buyer.whatsapp}
                  onChange={(e) => setBuyer((b) => ({ ...b, whatsapp: maskPhoneBR(e.target.value) }))}
                />
              </label>
              <label>
                CPF
                <input
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={buyer.cpf}
                  onChange={(e) => setBuyer((b) => ({ ...b, cpf: maskCPF(e.target.value) }))}
                />
              </label>
              <label>
                CEP
                <input required inputMode="numeric" autoComplete="postal-code" {...field("cep")} />
              </label>
              <label>
                Número
                <input required {...field("number")} />
              </label>
              <label className="full">
                Rua / Avenida
                <input required autoComplete="address-line1" {...field("street")} />
              </label>
              <label className="full">
                Complemento (opcional)
                <input autoComplete="address-line2" {...field("complement")} />
              </label>
              <label>
                Bairro
                <input required {...field("district")} />
              </label>
              <label>
                Cidade
                <input required autoComplete="address-level2" {...field("city")} />
              </label>
              <label>
                UF
                <input required maxLength={2} autoComplete="address-level1" {...field("state")} />
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
            <p className="lotp-muted lotp-small-text">
              Quando você abrir um pacote, a grade mostra a Legend que saiu, seu primeiro nome e sua cidade. O CPF vai só para a loja gerar a
              etiqueta de envio.
            </p>
            <div className="lotp-safety">
              <SafetyTips />
            </div>
            <label className="lotp-ack">
              <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} required />
              <span>Li as dicas e estou ciente de que combino pagamento e entrega diretamente com a loja.</span>
            </label>
            {error && <div className="lotp-error">{error}</div>}
            <button className="lotp-btn lotp-btn-gold" disabled={sending || !ciente || nums.length === 0 || falta > 0}>
              {sending ? "Registrando…" : "Fazer pedido"}
            </button>
            <button type="button" className="lotp-btn lotp-btn-ghost" onClick={onClose}>
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
