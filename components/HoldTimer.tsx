"use client";

import { CARRINHO_MINUTOS } from "@/lib/shop";
import { useNow } from "@/lib/useNow";

interface HoldTimerProps {
  expiresAt: string | null;
  /** "compact" para a barra flutuante; "full" dentro do carrinho, com a explicação. */
  variant?: "compact" | "full";
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Contagem regressiva da reserva do carrinho (10 min a partir do primeiro item).
export default function HoldTimer({ expiresAt, variant = "full" }: HoldTimerProps) {
  const now = useNow(1000);
  if (!expiresAt) return null;
  const restante = Date.parse(expiresAt) - now;
  const expirou = restante <= 0;
  const urgente = !expirou && restante < 2 * 60_000;

  if (variant === "compact") {
    return (
      <span className={`hold-timer-compact ${expirou ? "is-expired" : urgente ? "is-urgent" : ""}`}>
        {expirou ? "reserva expirada" : `reservado ${mmss(restante)}`}
      </span>
    );
  }

  return (
    <div className={`hold-timer ${expirou ? "is-expired" : urgente ? "is-urgent" : ""}`} role="status">
      {expirou ? (
        <>
          <strong>Sua reserva expirou.</strong> As figurinhas voltaram a ficar disponíveis para outras pessoas. Ao
          fechar o pedido, confirmamos o que ainda está disponível.
        </>
      ) : (
        <>
          <span className="hold-timer-clock">{mmss(restante)}</span>
          <span>
            Suas figurinhas estão <strong>reservadas para você</strong> por {CARRINHO_MINUTOS} minutos. Feche o pedido
            nesse prazo para garantir todas.
          </span>
        </>
      )}
    </div>
  );
}
