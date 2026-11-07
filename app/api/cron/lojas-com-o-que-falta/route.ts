import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { previewShopMatchEmail, sendShopMatchEmailTo, sweepShopMatchEmails } from "@/lib/shopMatchEmail";

// E-mail "lojas com o que falta na sua coleção". Protegido por CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
//
//   GET …?email=fulano@exemplo.com&ver=1    mostra o e-mail (HTML) sem enviar
//   GET …?email=fulano@exemplo.com          envia só para essa conta (teste; não conta como envio do lote)
//   GET …?lote=1&teste=1                    lote: lista quem receberia, sem enviar
//   GET …?lote=1                            lote: envia a quem tem mais de 100 itens, sem loja ligada,
//                                           e ainda não recebeu (&minimo=N muda o corte)
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
  const lote = q.get("lote") === "1";
  if (!email && !lote) return NextResponse.json({ error: "informe ?email= ou ?lote=1" }, { status: 400 });

  try {
    if (!email) {
      const minimo = Number(q.get("minimo"));
      return NextResponse.json(
        await sweepShopMatchEmails({ minItems: Number.isFinite(minimo) && minimo > 0 ? minimo : 100, dryRun: q.get("teste") === "1" })
      );
    }
    if (q.get("ver") === "1") {
      const p = await previewShopMatchEmail(email);
      if (p.status !== "ok") return NextResponse.json(p);
      return new NextResponse(p.html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "X-Assunto": encodeURIComponent(p.subject) },
      });
    }
    return NextResponse.json({ email, ...(await sendShopMatchEmailTo(email)) });
  } catch (e) {
    console.error("lojas com o que falta (e-mail):", e);
    return NextResponse.json({ error: "falha" }, { status: 500 });
  }
}
