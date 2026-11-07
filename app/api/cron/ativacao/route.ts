import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { previewActivationEmail, sendActivationEmailTo, sweepActivationEmails } from "@/lib/activationEmail";

// E-mail de ativação (conta sem nenhum item marcado). Protegido por CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
//
//   GET …?email=fulano@exemplo.com&ver=1          mostra o e-mail (HTML) sem enviar
//   GET …?email=fulano@exemplo.com                envia só para essa conta (teste; não conta como envio do lote)
//   GET …?lote=1&teste=1&excluir=fnadler,teste    lote: lista quem receberia, sem enviar
//   GET …?lote=1&excluir=…&limite=200             lote: envia a quem ainda não recebeu
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
        await sweepActivationEmails({
          dryRun: q.get("teste") === "1",
          exclude: (q.get("excluir") ?? "").split(","),
          limit: Number.isFinite(limite) && limite > 0 ? Math.min(limite, 400) : 200,
        })
      );
    }
    if (!email) return NextResponse.json({ error: "informe ?email= ou ?lote=1" }, { status: 400 });
    if (q.get("ver") === "1") {
      const p = await previewActivationEmail(email);
      if (p.status !== "ok") return NextResponse.json(p);
      return new NextResponse(p.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return NextResponse.json({ email, ...(await sendActivationEmailTo(email)) });
  } catch (e) {
    console.error("ativação (e-mail):", e);
    return NextResponse.json({ error: "falha" }, { status: 500 });
  }
}
