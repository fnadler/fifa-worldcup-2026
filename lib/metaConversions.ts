import "server-only";
import type { User } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { enviarLeadAdsPlatform } from "./adsPlatform";
import { cleanAttribution } from "./attribution";
import { sendCapiEvent, SITE_URL } from "./metaCapi";
import { clientIp } from "./rateLimit";
import { getStripe } from "./stripe";
import { createAdminClient } from "./supabase/admin";

// Conversões que nascem no servidor: atribuição gravada ao confirmar o cadastro e os eventos do
// Stripe (StartTrial, Subscribe) mandados à API de Conversões. Nada aqui pode lançar erro para quem
// chama — o cadastro e o webhook seguem mesmo que a Meta ou a migração falhem.

/**
 * Cadastro confirmado: grava a atribuição guardada no user_metadata.attr pelo LoginForm (último e
 * primeiro toque, com os IDs da Meta), com o IP e o user agent desta requisição, e envia o lead ao
 * ads-platform. Só a primeira vez (não sobrescreve). Contas sem `attr` (criadas antes
 * do rastreamento, ou um link de recuperação de senha) ficam de fora.
 */
export async function saveSignupAttribution(user: User, request: Request): Promise<void> {
  try {
    const meta = user.user_metadata as { attr?: unknown } | undefined;
    if (!meta || !("attr" in meta)) return;
    const a = cleanAttribution(meta.attr);
    const ip = clientIp(request);
    const base = {
      user_id: user.id,
      utm_source: a.utm_source ?? null,
      utm_medium: a.utm_medium ?? null,
      utm_campaign: a.utm_campaign ?? null,
      utm_content: a.utm_content ?? null,
      utm_term: a.utm_term ?? null,
      fbclid: a.fbclid ?? null,
      fbc: a.fbc ?? null,
      fbp: a.fbp ?? null,
      landing_path: a.landing_path ?? null,
      client_ip: ip === "desconhecido" ? null : ip,
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    };
    // Colunas de supabase_migration_marketing_attribution_ids.sql.
    const ids = {
      utm_campaign_id: a.utm_campaign_id ?? null,
      utm_adset_id: a.utm_adset_id ?? null,
      utm_ad_id: a.utm_ad_id ?? null,
      ftp_utm_source: a.ft?.utm_source ?? null,
      ftp_utm_medium: a.ft?.utm_medium ?? null,
      ftp_utm_campaign: a.ft?.utm_campaign ?? null,
      ftp_utm_content: a.ft?.utm_content ?? null,
      ftp_utm_campaign_id: a.ft?.utm_campaign_id ?? null,
      ftp_utm_adset_id: a.ft?.utm_adset_id ?? null,
      ftp_utm_ad_id: a.ft?.utm_ad_id ?? null,
      ftp_landing_path: a.ft?.landing_path ?? null,
      ftp_at: a.ft?.ts ? new Date(a.ft.ts).toISOString() : null,
    };
    const tabela = createAdminClient().from("marketing_attribution");
    let { error } = await tabela.upsert({ ...base, ...ids }, { onConflict: "user_id", ignoreDuplicates: true });
    // Migração dos IDs ainda não aplicada: grava ao menos o que já gravava (os IDs seguem no user_metadata).
    if (error && /column|schema cache/i.test(error.message)) {
      console.error("[atribuição] rode supabase_migration_marketing_attribution_ids.sql:", error.message);
      ({ error } = await tabela.upsert(base, { onConflict: "user_id", ignoreDuplicates: true }));
    }
    if (error) console.error("[atribuição]", user.id, error.message);
    const atribuicao = { ...a };
    delete atribuicao.fbc;
    delete atribuicao.fbp;
    delete atribuicao.ft;
    await enviarLeadAdsPlatform({
      idExterno: user.id,
      ocorridoEm: user.created_at,
      email: user.email,
      atribuicao,
      primeiroToque: a.ft,
    });
  } catch (err) {
    console.error("[atribuição]", user.id, err);
  }
}

interface MatchRow {
  client_ip: string | null;
  user_agent: string | null;
  fbc: string | null;
  fbp: string | null;
}

/** Dados para a Meta reconhecer a pessoa: e-mail da conta e o que foi gravado no cadastro. */
async function userData(userId: string) {
  const admin = createAdminClient();
  const [{ data: auth }, { data: attr }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("marketing_attribution")
      .select("client_ip, user_agent, fbc, fbp")
      .eq("user_id", userId)
      .maybeSingle<MatchRow>(),
  ]);
  return {
    email: auth?.user?.email ?? null,
    externalId: userId,
    ip: attr?.client_ip ?? null,
    userAgent: attr?.user_agent ?? null,
    fbc: attr?.fbc ?? null,
    fbp: attr?.fbp ?? null,
  };
}

async function userForSubscription(customer: string, metadataUserId?: string | null): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customer)
    .maybeSingle<{ user_id: string }>();
  return data?.user_id ?? null;
}

const idOf = (v: string | { id: string }) => (typeof v === "string" ? v : v.id);

/** Evento "website" exige user agent; sem ele (conta sem atribuição gravada) vai como system_generated. */
const sourceFor = (ua: string | null) => (ua ? ("website" as const) : ("system_generated" as const));

/** Assinatura criada em teste grátis → StartTrial (event_id fixo: reenvio do Stripe não duplica). */
export async function trackStartTrial(sub: Stripe.Subscription, eventTime: number): Promise<void> {
  try {
    if (sub.status !== "trialing") return;
    const userId = await userForSubscription(idOf(sub.customer), sub.metadata?.user_id);
    if (!userId) return console.error("[meta StartTrial] assinatura sem usuário", sub.id);
    const u = await userData(userId);
    await sendCapiEvent({
      eventName: "StartTrial",
      eventId: `trial_${sub.id}`,
      eventTime,
      actionSource: sourceFor(u.userAgent),
      eventSourceUrl: `${SITE_URL}/assinar`,
      userData: u,
      customData: { currency: "BRL", value: 0, content_name: "Assinatura da Loja" },
    });
  } catch (err) {
    console.error("[meta StartTrial]", sub.id, err);
  }
}

/** Primeira fatura com valor pago da assinatura → Subscribe, com o valor (event_id fixo por fatura). */
export async function trackFirstPayment(invoice: Stripe.Invoice, eventTime: number): Promise<void> {
  try {
    if (invoice.amount_paid <= 0 || !invoice.id || !invoice.customer) return;
    const details = invoice.parent?.subscription_details;
    if (!details?.subscription) return;
    const subscriptionId = idOf(details.subscription);

    // é mesmo a primeira paga com valor? (as anteriores, do teste, saem com 0)
    const paid = await getStripe().invoices.list({ subscription: subscriptionId, status: "paid", limit: 100 });
    const first = paid.data.filter((i) => i.amount_paid > 0).sort((a, b) => a.created - b.created)[0];
    if (first && first.id !== invoice.id) return;

    const userId = await userForSubscription(idOf(invoice.customer), details.metadata?.user_id);
    if (!userId) return console.error("[meta Subscribe] fatura sem usuário", invoice.id);
    const u = await userData(userId);
    await sendCapiEvent({
      eventName: "Subscribe",
      eventId: `sub_${invoice.id}`,
      eventTime,
      actionSource: sourceFor(u.userAgent),
      eventSourceUrl: `${SITE_URL}/assinar`,
      userData: u,
      customData: {
        value: invoice.amount_paid / 100,
        currency: (invoice.currency || "brl").toUpperCase(),
        content_name: "Assinatura da Loja",
        subscription_id: subscriptionId,
      },
    });

    // marca o pagante no funil (só a primeira vez)
    const { error } = await createAdminClient()
      .from("marketing_attribution")
      .update({ paid_at: new Date(eventTime * 1000).toISOString() })
      .eq("user_id", userId)
      .is("paid_at", null);
    if (error) console.error("[meta Subscribe] paid_at", userId, error.message);
  } catch (err) {
    console.error("[meta Subscribe]", invoice.id, err);
  }
}
