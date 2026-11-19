"use client";

import { detectSource, type FunnelSource, type FunnelStep } from "./packFunnel";

// Registra uma etapa do funil da página do lote. Visitante = id aleatório guardado no navegador (sem dados
// pessoais). Cada etapa vai uma vez por visitante (o banco ignora as repetidas); aqui só evitamos chamadas
// à toa na mesma aba. Falhas são silenciosas: medir não pode atrapalhar a compra.

const VISITOR_KEY = "gn-visitor-v1";
const SOURCE_KEY = "gn-pack-source-v1";

function visitorId(): string {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Origem desta visita, lida na chegada e mantida enquanto a aba estiver aberta. */
function visitSource(): FunnelSource {
  try {
    const saved = window.sessionStorage.getItem(SOURCE_KEY) as FunnelSource | null;
    if (saved) return saved;
    const s = detectSource(window.location.search, document.referrer, window.location.hostname);
    window.sessionStorage.setItem(SOURCE_KEY, s);
    return s;
  } catch {
    return detectSource(window.location.search, document.referrer, window.location.hostname);
  }
}

const sent = new Set<string>();

export function funnel(lotId: string, step: FunnelStep): void {
  const key = `${lotId}:${step}`;
  if (sent.has(key)) return;
  sent.add(key);
  try {
    void fetch(`/api/pacotes/${lotId}/funil`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, visitor: visitorId(), source: visitSource() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sem rede: segue
  }
}
