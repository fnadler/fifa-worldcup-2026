"use client";

import { useEffect, useState } from "react";

// Relógio que re-renderiza a cada `intervalMs` — para contagens regressivas (reserva de pedidos).
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
