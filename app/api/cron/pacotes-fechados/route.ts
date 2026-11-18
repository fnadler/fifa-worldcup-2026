import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweepPackReminders } from "@/lib/packsReminder";

// Lembrete "você ainda tem pacotes fechados" (lib/packsReminder.ts). Protegido por CRON_SECRET
// (Authorization: Bearer <CRON_SECRET>; a Vercel manda sozinha no agendamento — vercel.json, todo dia).
//
//   GET …?teste=1                lista quem receberia, sem enviar
//   GET …?para=eu@exemplo.com    envia todos os lembretes devidos para esse e-mail (validação; não conta como envio)
//   GET …                        envia (até ?limite=, padrão 100)
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function mesmoTexto(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !mesmoTexto(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams;
  const limite = Number(q.get("limite"));
  try {
    return NextResponse.json(
      await sweepPackReminders({
        dryRun: q.get("teste") === "1",
        limit: Number.isFinite(limite) && limite > 0 ? Math.min(limite, 300) : 100,
        to: q.get("para"),
      })
    );
  } catch (e) {
    console.error("pacotes fechados (lembrete):", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
