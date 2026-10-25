// Atribuição de marketing: de onde veio a visita que acabou em cadastro.
// Sem dependências — usado no proxy (grava os cookies), no cadastro (navegador) e no servidor.
//
// gn_attr: JSON com os utm_*, os IDs da Meta (utm_campaign_id/utm_adset_id/utm_ad_id), fbclid,
// landing_path e ts, gravado pelo proxy quando a URL traz UTM ou fbclid (last-touch).
// gn_attr_ft: o mesmo JSON da PRIMEIRA visita com atribuição (first-touch, nunca sobrescrito).
// _fbc / _fbp: cookies da Meta (o _fbp é criado pelo Pixel; o _fbc, pelo proxy ou pelo Pixel).
// Os IDs são o que a atribuição usa: nomes de campanha e anúncio mudam e se repetem.

export const ATTR_COOKIE = "gn_attr";
export const FIRST_TOUCH_COOKIE = "gn_attr_ft";
export const FBC_COOKIE = "_fbc";
export const FBP_COOKIE = "_fbp";

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_campaign_id",
  "utm_adset_id",
  "utm_ad_id",
] as const;
type UtmKey = (typeof UTM_KEYS)[number];

export type Attribution = Partial<Record<UtmKey | "fbclid" | "landing_path", string>> & { ts?: number };

/** O que vai em user_metadata.attr no cadastro (e depois para marketing_attribution). ft = primeiro toque. */
export type SignupAttribution = Attribution & { fbc?: string; fbp?: string; ft?: Attribution };

const MAX_LEN = 300;
const ATTR_KEYS = [...UTM_KEYS, "fbclid", "landing_path"] as const;

export const ATTR_MAX_AGE = 60 * 60 * 24 * 30;
export const FIRST_TOUCH_MAX_AGE = 60 * 60 * 24 * 90;

const clip = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_LEN) : undefined;

/** A URL traz algo de atribuição? Devolve o que gravar em gn_attr, ou null. */
export function attributionFromUrl(params: URLSearchParams, pathname: string, now: number): Attribution | null {
  const out: Attribution = {};
  for (const k of [...UTM_KEYS, "fbclid"] as const) {
    const v = clip(params.get(k));
    if (v) out[k] = v;
  }
  if (Object.keys(out).length === 0) return null;
  out.landing_path = pathname.slice(0, MAX_LEN);
  out.ts = now;
  return out;
}

/** Lê e limpa um objeto de atribuição vindo de fora (cookie ou user_metadata). */
export function cleanAttribution(raw: unknown): SignupAttribution {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: SignupAttribution = {};
  for (const k of [...ATTR_KEYS, "fbc", "fbp"] as const) {
    const v = clip(r[k]);
    if (v) out[k] = v;
  }
  if (typeof r.ts === "number" && Number.isFinite(r.ts)) out.ts = r.ts;
  if (r.ft && typeof r.ft === "object") {
    const ft: Attribution = {};
    const f = r.ft as Record<string, unknown>;
    for (const k of ATTR_KEYS) {
      const v = clip(f[k]);
      if (v) ft[k] = v;
    }
    if (typeof f.ts === "number" && Number.isFinite(f.ts)) ft.ts = f.ts;
    if (Object.keys(ft).length) out.ft = ft;
  }
  return out;
}

export function parseAttrCookie(value: string | undefined): Attribution {
  if (!value) return {};
  try {
    return cleanAttribution(JSON.parse(value));
  } catch {
    return {};
  }
}

/** _fbc no formato da Meta: fb.1.<timestamp_ms>.<fbclid> */
export const fbcFromClick = (fbclid: string, now: number) => `fb.1.${now}.${fbclid}`;

/** O _fbc atual já é deste clique? */
export const fbcMatches = (fbc: string | undefined, fbclid: string) => Boolean(fbc?.endsWith(`.${fbclid}`));
