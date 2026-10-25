import "server-only";
import { createHash } from "node:crypto";

// API de Conversões da Meta (eventos enviados pelo servidor). Rastreamento nunca pode quebrar quem
// chama: sem configuração só avisa no log; erro ou demora da Meta só vira console.error.

const GRAPH_VERSION = "v26.0";
const TIMEOUT_MS = 3000;

export const SITE_URL = "https://www.gncoleciona.com.br";

export type CapiActionSource = "website" | "system_generated";

export interface CapiUserData {
  email?: string | null;
  /** user.id do Supabase. */
  externalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
}

export interface CapiEvent {
  eventName: string;
  eventId: string;
  /** Unix, em segundos. Padrão: agora. */
  eventTime?: number;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
  eventSourceUrl?: string;
  actionSource: CapiActionSource;
}

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export function capiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

let warned = false;

export async function sendCapiEvent(event: CapiEvent): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    if (!warned) console.warn("[meta capi] sem NEXT_PUBLIC_META_PIXEL_ID/META_CAPI_ACCESS_TOKEN — eventos não enviados");
    warned = true;
    return;
  }

  const u = event.userData;
  const user_data: Record<string, unknown> = {};
  if (u.email) user_data.em = [sha256(u.email)];
  if (u.externalId) user_data.external_id = [sha256(u.externalId)];
  if (u.ip) user_data.client_ip_address = u.ip;
  if (u.userAgent) user_data.client_user_agent = u.userAgent;
  if (u.fbc) user_data.fbc = u.fbc;
  if (u.fbp) user_data.fbp = u.fbp;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_id: event.eventId,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        action_source: event.actionSource,
        ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
        user_data,
        ...(event.customData ? { custom_data: event.customData } : {}),
      },
    ],
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      }
    );
    if (!res.ok) console.error("[meta capi]", event.eventName, event.eventId, res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("[meta capi]", event.eventName, event.eventId, err instanceof Error ? err.message : err);
  }
}
