import { NextResponse } from "next/server";
import { FUNNEL_SOURCES, FUNNEL_STEPS, type FunnelSource, type FunnelStep } from "@/lib/packFunnel";
import { withinRateLimit, type RateRule } from "@/lib/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";

// Etapa do funil da página do lote (visitou, tocou num pacote, abriu o pedido, fez o pedido).
// Uma linha por visitante e etapa — repetições são ignoradas pelo banco. Sempre responde 204: é medição.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISITOR = /^[0-9a-z-]{8,64}$/i;
const LIMITE: RateRule[] = [{ name: "funil", windowSeconds: 600, max: 120 }];
const done = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request, { params }: { params: Promise<{ lot: string }> }) {
  const { lot } = await params;
  let body: { step?: unknown; visitor?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return done();
  }
  const step = body.step as FunnelStep;
  const visitor = typeof body.visitor === "string" ? body.visitor : "";
  const source = (FUNNEL_SOURCES as readonly string[]).includes(body.source as string) ? (body.source as FunnelSource) : "outro";
  if (!UUID.test(lot) || !FUNNEL_STEPS.includes(step) || !VISITOR.test(visitor)) return done();

  const admin = createAdminClient();
  if (!(await withinRateLimit(admin, request, LIMITE))) return done();
  // Lote inexistente: a chave estrangeira recusa e a gente ignora.
  await admin.from("pack_lot_events").upsert({ lot_id: lot, visitor, step, source }, { onConflict: "lot_id,visitor,step", ignoreDuplicates: true });
  return done();
}
