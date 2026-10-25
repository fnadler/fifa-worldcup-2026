// Reenvia ao ads-platform os cadastros com atribuição gravados em marketing_attribution (todos, ou só
// os criados a partir de uma data). O ads-platform é idempotente pelo user_id: reenviar não duplica.
//
//   node --env-file=.env.local scripts/reenviar-leads-ads-platform.mjs [AAAA-MM-DD]
//
// Precisa de NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADS_PLATFORM_URL e ADS_PLATFORM_TOKEN.
import { createClient } from "@supabase/supabase-js";

const desde = process.argv[2] ?? "1970-01-01";
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADS_PLATFORM_URL, ADS_PLATFORM_TOKEN } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADS_PLATFORM_URL || !ADS_PLATFORM_TOKEN) {
  console.error("Faltam variáveis: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADS_PLATFORM_URL, ADS_PLATFORM_TOKEN.");
  process.exit(1);
}
const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CAMPOS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_campaign_id", "utm_adset_id", "utm_ad_id"];
const limpo = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ""));

// E-mails das contas (o ads-platform guarda só o hash).
const emails = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) emails.set(u.id, { email: u.email, criado: u.created_at });
  if (data.users.length < 1000) break;
}

let enviados = 0;
for (let de = 0; ; de += 500) {
  const { data, error } = await admin
    .from("marketing_attribution")
    .select("*")
    .gte("created_at", desde)
    .order("created_at")
    .range(de, de + 499);
  if (error) throw error;
  const eventos = data.map((r) => ({
    tipo: "lead",
    id_externo: r.user_id,
    ocorrido_em: emails.get(r.user_id)?.criado ?? r.created_at,
    email: emails.get(r.user_id)?.email ?? undefined,
    atribuicao: limpo({ ...Object.fromEntries(CAMPOS.map((c) => [c, r[c]])), fbclid: r.fbclid, landing_path: r.landing_path }),
    primeiro_toque: limpo({ ...Object.fromEntries(CAMPOS.map((c) => [c, r[`ftp_${c}`]])), landing_path: r.ftp_landing_path }),
  }));
  if (eventos.length) {
    const resposta = await fetch(`${ADS_PLATFORM_URL.replace(/\/$/, "")}/api/webhook/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADS_PLATFORM_TOKEN}` },
      body: JSON.stringify({ eventos }),
    });
    if (!resposta.ok) throw new Error(`ads-platform respondeu ${resposta.status}: ${await resposta.text()}`);
    enviados += eventos.length;
  }
  if (data.length < 500) break;
}
console.log(`${enviados} cadastros reenviados (desde ${desde}).`);
