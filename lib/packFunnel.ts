// Funil da página do lote (compartilhado entre navegador, rota e painel).

export const FUNNEL_STEPS = ["view", "pick", "checkout", "order"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const FUNNEL_LABEL: Record<FunnelStep, string> = {
  view: "Visitaram a página",
  pick: "Tocaram em um pacote",
  checkout: "Abriram o pedido",
  order: "Fizeram o pedido",
};

export const FUNNEL_SOURCES = ["email", "instagram", "whatsapp", "facebook", "google", "site", "direto", "outro"] as const;
export type FunnelSource = (typeof FUNNEL_SOURCES)[number];

export const SOURCE_LABEL: Record<FunnelSource, string> = {
  email: "E-mail",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  google: "Google",
  site: "Dentro do site",
  direto: "Link direto",
  outro: "Outros",
};

/** utm_source livre ("IG", "insta", "e-mail"…) → uma das origens conhecidas. */
export function normalizeSource(raw: string): FunnelSource {
  const s = raw.toLowerCase();
  if (/mail/.test(s)) return "email";
  if (/^ig$|insta/.test(s)) return "instagram";
  if (/^wa$|whats|zap|comunidade/.test(s)) return "whatsapp";
  if (/^fb$|facebook|^meta/.test(s)) return "facebook";
  if (/google/.test(s)) return "google";
  return (FUNNEL_SOURCES as readonly string[]).includes(s) ? (s as FunnelSource) : "outro";
}

/** Origem da visita: utm_source da URL; senão fbclid; senão o site de onde a pessoa veio. */
export function detectSource(search: string, referrer: string, ownHost: string): FunnelSource {
  const q = new URLSearchParams(search);
  const utm = q.get("utm_source");
  if (utm) return normalizeSource(utm);
  if (q.get("fbclid")) return "facebook";
  if (!referrer) return "direto";
  let host = "";
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "outro";
  }
  if (host === ownHost.replace(/^www\./, "")) return "site";
  if (/instagram\.com$/.test(host)) return "instagram";
  if (/facebook\.com$|fb\.com$|fb\.me$/.test(host)) return "facebook";
  if (/whatsapp\.(com|net)$|wa\.me$/.test(host)) return "whatsapp";
  if (/google\./.test(host)) return "google";
  if (/mail\./.test(host) || /outlook|gmail/.test(host)) return "email";
  return "outro";
}
