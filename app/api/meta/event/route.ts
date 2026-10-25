import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FBC_COOKIE, FBP_COOKIE } from "@/lib/attribution";
import { capiConfigured, sendCapiEvent } from "@/lib/metaCapi";
import { clientIp, TOO_MANY, withinRateLimit } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Eventos que nascem no navegador e vão também para a API de Conversões, com o mesmo event_id do
// Pixel (deduplicação). O IP, o user agent, os cookies da Meta e o usuário logado são lidos aqui.
const EVENTOS = new Set(["CompleteRegistration", "InitiateCheckout", "ViewContent"]);

const EVENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;

export async function POST(request: Request) {
  if (!capiConfigured()) return new NextResponse(null, { status: 204 });

  const body = (await request.json().catch(() => null)) as {
    eventName?: unknown;
    eventId?: unknown;
    email?: unknown;
    eventSourceUrl?: unknown;
  } | null;
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  if (!EVENTOS.has(eventName) || !EVENT_ID.test(eventId)) {
    return NextResponse.json({ error: "evento inválido" }, { status: 400 });
  }

  const ok = await withinRateLimit(createAdminClient(), request, [
    { name: "meta-evento", windowSeconds: 60, max: 30 },
    { name: "meta-evento-dia", windowSeconds: 86400, max: 400 },
  ]);
  if (!ok) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  // só endereços do próprio site (o Pixel manda a URL da página; aqui vale a mesma regra)
  const origin = new URL(request.url).origin;
  const rawUrl = typeof body?.eventSourceUrl === "string" ? body.eventSourceUrl : "";
  const eventSourceUrl = rawUrl.startsWith(`${origin}/`) ? rawUrl.slice(0, 1000) : `${origin}/`;
  const email = typeof body?.email === "string" && EMAIL.test(body.email.trim()) ? body.email.trim() : null;

  const jar = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const event = {
    eventName,
    eventId,
    eventSourceUrl,
    actionSource: "website" as const,
    userData: {
      email: email ?? user?.email ?? null,
      externalId: user?.id ?? null,
      ip: clientIp(request) === "desconhecido" ? null : clientIp(request),
      userAgent: request.headers.get("user-agent"),
      fbc: jar.get(FBC_COOKIE)?.value ?? null,
      fbp: jar.get(FBP_COOKIE)?.value ?? null,
    },
  };
  // responde já; o envio à Meta segue depois da resposta
  after(() => sendCapiEvent(event));
  return new NextResponse(null, { status: 204 });
}
