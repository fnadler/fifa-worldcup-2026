// Microsoft Clarity no navegador: gravações de sessão, mapas de calor e métricas de experiência
// (rolagem, cliques sem resposta, erros de script). Quem carrega o Clarity é components/Clarity.tsx
// (único ponto de entrada — para condicionar a um consentimento no futuro, basta não montar aquele
// componente). Antes de o script chegar, as chamadas ficam na fila window.clarity.q, como no snippet
// oficial.

import type { SignupAttribution } from "./attribution";

export const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

/** Cria a fila window.clarity (o clarity.js a consome ao carregar). */
export function ensureClarityQueue(): void {
  if (!CLARITY_ID || typeof window === "undefined" || window.clarity) return;
  const fn = function (...args: unknown[]) {
    (fn.q = fn.q || []).push(args);
  } as ClarityFn;
  window.clarity = fn;
}

function call(...args: unknown[]): void {
  if (!CLARITY_ID || typeof window === "undefined") return;
  ensureClarityQueue();
  window.clarity?.(...args);
}

/**
 * Liga a sessão ao usuário da GN (o mesmo user_id que vai como id_externo para a ferramenta de
 * análise de anúncios). O Clarity guarda o identificador em hash; não mandamos e-mail nem nome.
 */
export function clarityIdentify(userId: string): void {
  call("identify", userId);
}

/** Marcação da sessão, filtrável no painel do Clarity. */
export function claritySet(key: string, value: string | undefined): void {
  if (value) call("set", key, value);
}

/** Evento do funil, para filtrar gravações (ex.: quem chegou ao checkout). */
export function clarityEvent(name: string): void {
  call("event", name);
}

const META_SOURCES = new Set(["facebook", "fb", "instagram", "ig", "meta"]);

/** De onde veio a visita, em uma palavra: anuncio_meta, link (outra UTM) ou direto. */
export function originOf(attr: SignupAttribution): "anuncio_meta" | "link" | "direto" {
  const source = attr.utm_source?.toLowerCase();
  if (attr.fbclid || attr.utm_ad_id || (source && META_SOURCES.has(source))) return "anuncio_meta";
  if (source || attr.utm_campaign) return "link";
  return "direto";
}

/** Marca a sessão com a origem (último toque), para filtrar gravações por campanha e anúncio. */
export function clarityTagAttribution(attr: SignupAttribution): void {
  claritySet("origem", originOf(attr));
  claritySet("utm_source", attr.utm_source);
  claritySet("utm_campaign", attr.utm_campaign);
  claritySet("utm_content", attr.utm_content);
  claritySet("campaign_id", attr.utm_campaign_id);
  claritySet("adset_id", attr.utm_adset_id);
  claritySet("ad_id", attr.utm_ad_id);
}
