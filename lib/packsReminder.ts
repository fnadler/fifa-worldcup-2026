import "server-only";
import { DEFAULT_SHOP_NAME } from "./brand";
import { packsReadyHtml, packsReadySubject, packsReadyText } from "./email/packsReady";
import { emailConfigured, sendEmail } from "./email/resend";
import { createAdminClient } from "./supabase/admin";

// Lembrete "você ainda tem pacotes fechados": pedidos de pacotes confirmados, com o aviso enviado há mais
// de 24h e algum pacote ainda fechado. No máximo 2 lembretes por pedido, com 48h entre eles.

const DIA = 86_400_000;
const MAX_LEMBRETES = 2;

export interface ReminderResult {
  candidates: number;
  sent: { code: string; email: string; closed: number }[];
  failed: { code: string; error: string }[];
  dryRun: boolean;
}

export async function sweepPackReminders({ dryRun, limit, to }: { dryRun: boolean; limit: number; to?: string | null }): Promise<ReminderResult> {
  const admin = createAdminClient();
  const agora = Date.now();
  const { data: orders, error } = await admin
    .from("orders")
    .select("id, code, buyer_name, buyer_email, seller_id, pack_token, packs_notified_at, packs_reminders, packs_reminded_at")
    .eq("status", "confirmado")
    .not("pack_token", "is", null)
    .not("packs_notified_at", "is", null)
    .lt("packs_notified_at", new Date(agora - DIA).toISOString())
    .lt("packs_reminders", MAX_LEMBRETES)
    .limit(500);
  if (error) throw error;

  const result: ReminderResult = { candidates: 0, sent: [], failed: [], dryRun };
  const due = (orders ?? []).filter((o) => !o.packs_reminded_at || Date.parse(o.packs_reminded_at) < agora - 2 * DIA);
  if (!due.length) return result;

  const [{ data: packs }, { data: shops }] = await Promise.all([
    admin.from("packs").select("order_id, number, opened_at").in("order_id", due.map((o) => o.id)),
    admin.from("shops").select("user_id, seller_name").in("user_id", [...new Set(due.map((o) => o.seller_id))]),
  ]);
  const nomeLoja = new Map((shops ?? []).map((s) => [s.user_id as string, (s.seller_name as string | null) || DEFAULT_SHOP_NAME]));

  for (const o of due) {
    const meus = (packs ?? []).filter((p) => p.order_id === o.id);
    const closed = meus.filter((p) => !p.opened_at).length;
    if (!closed) continue;
    result.candidates++;
    if (result.sent.length >= limit) continue;
    const notice = {
      buyerName: o.buyer_name as string,
      code: o.code as string,
      token: o.pack_token as string,
      numbers: meus.map((p) => p.number as number).sort((a, b) => a - b),
      shopName: nomeLoja.get(o.seller_id as string) ?? DEFAULT_SHOP_NAME,
    };
    const email = to || (o.buyer_email as string);
    if (dryRun) {
      result.sent.push({ code: notice.code, email, closed });
      continue;
    }
    if (!emailConfigured()) throw new Error("RESEND_API_KEY não configurada");
    try {
      await sendEmail({ to: email, subject: packsReadySubject(notice, closed), html: packsReadyHtml(notice, closed), text: packsReadyText(notice, closed) });
      if (!to) {
        await admin
          .from("orders")
          .update({ packs_reminders: (o.packs_reminders as number) + 1, packs_reminded_at: new Date().toISOString() })
          .eq("id", o.id);
      }
      result.sent.push({ code: notice.code, email, closed });
    } catch (e) {
      result.failed.push({ code: notice.code, error: (e as Error).message });
    }
  }
  return result;
}
