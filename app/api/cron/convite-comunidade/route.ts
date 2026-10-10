import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendCommunityInviteTo, sweepCommunityInvites } from "@/lib/communityInvite";

// Convite da comunidade por e-mail para quem ainda não recebeu. Protegido por CRON_SECRET
// (a Vercel manda "Authorization: Bearer <CRON_SECRET>" nas chamadas agendadas — ver vercel.json).
//
//   GET /api/cron/convite-comunidade            varredura diária: contas dos últimos 7 dias
//   GET …?todos=1&limite=200                    envio para quem já tinha conta (repita até pendentes = 0)
//   GET …?todos=1&teste=1                       só conta quem receberia, sem enviar
//   GET …?email=fulano@exemplo.com              envia só para essa conta (teste antes do envio geral)
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// comparação em tempo constante: não revela, pelo tempo de resposta, quanto do segredo já está certo
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
  const limite = Math.min(Math.max(Number(q.get("limite")) || 200, 1), 400);
  try {
    const email = q.get("email");
    if (email) return NextResponse.json({ email, resultado: await sendCommunityInviteTo(email) });

    const out = await sweepCommunityInvites({
      sinceDays: q.get("todos") === "1" ? undefined : 7,
      limit: limite,
      dryRun: q.get("teste") === "1",
    });
    return NextResponse.json(out);
  } catch (e) {
    console.error("convite da comunidade (varredura):", e);
    return NextResponse.json({ error: "falha na varredura" }, { status: 500 });
  }
}
