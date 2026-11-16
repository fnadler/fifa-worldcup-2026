import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { previewRepetidas, sendRepetidasTo, sweepRepetidas } from "@/lib/repetidasEmail";

// "Suas repetidas podem valer até R$ X": quem passou de LIMITE_REPETIDAS repetidas e não tem loja. Protegido por CRON_SECRET
// (Authorization: Bearer <CRON_SECRET>). Envio único por conta, então pode rodar todo dia (vercel.json).
//
//   GET …?email=fulano@exemplo.com&ver=1     mostra o e-mail (HTML) sem enviar
//   GET …?email=fulano@exemplo.com           envia só para essa conta (teste; não conta como envio do lote)
//   GET …?email=fulano@exemplo.com&para=eu@x  monta com os números de fulano e envia para eu@x (validação)
//   GET …?lote=1&teste=1&excluir=fnadler      lote: lista quem receberia, sem enviar
//   GET …?lote=1&excluir=…&limite=100        lote: envia a quem passou do limite e ainda não recebeu
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
  const email = q.get("email");
  try {
    if (q.get("lote") === "1") {
      const limite = Number(q.get("limite"));
      return NextResponse.json(
        await sweepRepetidas({
          dryRun: q.get("teste") === "1",
          exclude: (q.get("excluir") ?? "").split(","),
          limit: Number.isFinite(limite) && limite > 0 ? Math.min(limite, 400) : 100,
        })
      );
    }
    if (!email) return NextResponse.json({ error: "informe ?email= ou ?lote=1" }, { status: 400 });
    if (q.get("ver") === "1") {
      const p = await previewRepetidas(email);
      if (p.status !== "ok") return NextResponse.json(p);
      return new NextResponse(p.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return NextResponse.json({ email, ...(await sendRepetidasTo(email, q.get("para"))) });
  } catch (e) {
    console.error("repetidas (e-mail):", e);
    return NextResponse.json({ error: "falha" }, { status: 500 });
  }
}
