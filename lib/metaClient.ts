// Pixel da Meta no navegador. Quem carrega o Pixel é components/MetaPixel.tsx (único ponto de
// entrada — para condicionar a um consentimento no futuro, basta não montar aquele componente).
// Antes de o Pixel ser ativado, os eventos ficam numa fila e saem quando ele ativa.

import { ATTR_COOKIE, FBC_COOKIE, FBP_COOKIE, FIRST_TOUCH_COOKIE, parseAttrCookie, type SignupAttribution } from "./attribution";

export const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

/** Eventos que o navegador também manda para a API de Conversões (via /api/meta/event). */
export type BrowserServerEvent = "CompleteRegistration" | "InitiateCheckout" | "ViewContent";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; loaded?: boolean; version?: string; push?: unknown };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let active = false;
const pending: unknown[][] = [];

/**
 * Cria o fbq (a mesma fila do snippet oficial, que o fbevents.js consome ao carregar), faz o init e
 * libera os eventos que esperavam. Chamado por MetaPixel.
 */
export function activatePixel(): void {
  if (active || !PIXEL_ID || typeof window === "undefined") return;
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
  }
  window.fbq("init", PIXEL_ID);
  active = true;
  for (const args of pending.splice(0)) window.fbq(...args);
}

export function newEventId(): string {
  return crypto.randomUUID();
}

/** Dispara um evento no Pixel. Sem Pixel configurado, não faz nada. */
export function track(eventName: string, params?: Record<string, unknown>, eventId?: string): void {
  if (!PIXEL_ID || typeof window === "undefined") return;
  const args = ["track", eventName, params ?? {}, ...(eventId ? [{ eventID: eventId }] : [])];
  if (active && window.fbq) window.fbq(...args);
  else pending.push(args);
}

/**
 * Mesmo evento no Pixel e na API de Conversões, com o mesmo event_id (a Meta conta uma vez só).
 * `email` só para o cadastro: vai ao nosso servidor, que manda à Meta apenas o hash.
 */
export function trackWithServer(eventName: BrowserServerEvent, params?: Record<string, unknown>, email?: string): void {
  if (!PIXEL_ID) return;
  const eventId = newEventId();
  track(eventName, params, eventId);
  void fetch("/api/meta/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, eventId, email, eventSourceUrl: window.location.href }),
    keepalive: true, // o InitiateCheckout sai logo antes de ir para o Stripe
  }).catch(() => {});
}

function readCookie(name: string): string | undefined {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  if (!hit) return undefined;
  try {
    return decodeURIComponent(hit.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

/** Atribuição deste navegador (gn_attr, gn_attr_ft + _fbc/_fbp), para guardar no user_metadata do cadastro. */
export function readSignupAttribution(): SignupAttribution {
  const attr: SignupAttribution = parseAttrCookie(readCookie(ATTR_COOKIE));
  const ft = parseAttrCookie(readCookie(FIRST_TOUCH_COOKIE));
  if (Object.keys(ft).length) attr.ft = ft;
  const fbc = readCookie(FBC_COOKIE);
  const fbp = readCookie(FBP_COOKIE);
  if (fbc) attr.fbc = fbc;
  if (fbp) attr.fbp = fbp;
  return attr;
}
