"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeSticker, type CartHold } from "./shop";
import type { Qtd } from "./types";

export interface CartAdjust {
  code: string;
  requested: number;
  granted: number;
}

interface HoldResponse {
  items: { code: string; qty: number }[];
  expiresAt: string | null;
  adjusted: CartAdjust[];
}

const DEBOUNCE_MS = 400;

function toQtd(items: { code: string; qty: number }[]): Qtd {
  const out: Qtd = {};
  items.forEach((i) => (out[i.code] = i.qty));
  return out;
}

export function describeAdjust(a: CartAdjust): string {
  return a.granted === 0
    ? `${a.code} (${describeSticker(a.code)}) não está mais disponível`
    : `${a.code}: só ${a.granted} de ${a.requested} disponíve${a.granted === 1 ? "l" : "is"}`;
}

// Carrinho com reserva no servidor: cada alteração é aplicada na hora na tela e enviada
// (agrupada) para /api/loja/<token>/carrinho, que reserva por 10 min e devolve o que foi
// realmente reservado. A resposta do servidor é a verdade final do carrinho.
export function useCartHold({
  token,
  available,
  initialHold,
  onToast,
}: {
  token: string;
  /** Disponível para este comprador (já sem o que outros reservaram). */
  available: Qtd;
  initialHold: CartHold | null;
  onToast: (msg: string) => void;
}) {
  const storageKey = `copa2026-cart-${token}`;
  const [cart, setCart] = useState<Qtd>(() => (initialHold ? toQtd(initialHold.items) : {}));
  const [expiresAt, setExpiresAt] = useState<string | null>(initialHold?.expiresAt ?? null);
  const [syncing, setSyncing] = useState(false);

  const cartRef = useRef(cart);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: Qtd) => {
      cartRef.current = next;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // conveniência apenas
      }
    },
    [storageKey]
  );

  // Sem reserva ativa no servidor: recupera o carrinho salvo neste navegador (sem reserva —
  // ela é refeita na próxima alteração ou ao fechar o pedido).
  useEffect(() => {
    if (initialHold) {
      persist(toQtd(initialHold.items));
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Qtd;
      const clamped: Qtd = {};
      Object.entries(saved).forEach(([code, n]) => {
        const q = Math.min(n, available[code] ?? 0);
        if (q > 0) clamped[code] = q;
      });
      cartRef.current = clamped;
      queueMicrotask(() => setCart(clamped));
    } catch {
      // sem carrinho salvo
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (silent = false): Promise<HoldResponse | null> => {
    const seq = ++seqRef.current;
    const items = Object.entries(cartRef.current).map(([code, qty]) => ({ code, qty }));
    setSyncing(true);
    try {
      const res = await fetch(`/api/loja/${token}/carrinho`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = (await res.json()) as HoldResponse & { error?: string };
      if (!res.ok) {
        onToast(data.error ?? "Não foi possível reservar o carrinho — tente de novo.");
        return null;
      }
      if (seq !== seqRef.current) return data; // chegou uma alteração mais nova: ela manda
      const next = toQtd(data.items);
      persist(next);
      setCart(next);
      setExpiresAt(data.expiresAt);
      if (data.adjusted.length && !silent) onToast(data.adjusted.map(describeAdjust).join(" · "));
      return data;
    } catch {
      onToast("Sem conexão — o carrinho não foi reservado. Tente de novo.");
      return null;
    } finally {
      if (seq === seqRef.current) setSyncing(false);
    }
  }, [token, persist, onToast]);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void send();
    }, DEBOUNCE_MS);
  }, [send]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const changeQty = useCallback(
    (code: string, delta: number) => {
      const prev = cartRef.current;
      const q = Math.max(0, Math.min(available[code] ?? 0, (prev[code] ?? 0) + delta));
      if (q === (prev[code] ?? 0)) return;
      const next = { ...prev };
      if (q === 0) delete next[code];
      else next[code] = q;
      persist(next);
      setCart(next);
      schedule();
    },
    [available, persist, schedule]
  );

  const remove = useCallback(
    (code: string) => {
      const next = { ...cartRef.current };
      delete next[code];
      persist(next);
      setCart(next);
      schedule();
    },
    [persist, schedule]
  );

  const clear = useCallback(() => {
    persist({});
    setCart({});
    setExpiresAt(null);
    schedule();
  }, [persist, schedule]);

  /** Envia já (sem esperar o agrupamento) e devolve o resultado — usado na confirmação. */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return send(true);
  }, [send]);

  /** Pedido concluído: o servidor já apagou a reserva; só zera o estado local. */
  const resetAfterOrder = useCallback(() => {
    persist({});
    setCart({});
    setExpiresAt(null);
  }, [persist]);

  return { cart, expiresAt, syncing, changeQty, remove, clear, flush, resetAfterOrder };
}
