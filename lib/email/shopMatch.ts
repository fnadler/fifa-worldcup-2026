import { PLATFORM_NAME } from "../brand";

// E-mail "lojas com o que falta na sua coleção": o mesmo cálculo do botão Quero comprar (lib/shopMatch.ts),
// com as lojas mais compatíveis de cada coleção e a % por categoria. HTML em tabelas com estilo inline
// (é o que os programas de e-mail entendem) + versão em texto.

const SITE = "https://www.gncoleciona.com.br";
const GREEN = "#029838"; // o mesmo verde do fundo do logo (public/brand/gn-coleciona-logo-email.png)
const INK = "#0b2a17";
const MUTED = "#5b7566";
const TRACK = "#e1e9e3";
const FONT = "font-family:Arial,Helvetica,sans-serif;";
const UTM = "utm_source=email&utm_medium=email&utm_campaign=lojas-com-o-que-falta";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => n.toLocaleString("pt-BR");

export interface MatchCountInput {
  matched: number;
  missing: number;
}

export interface ShopMatchEmailShop extends MatchCountInput {
  name: string;
  /** Caminho da loja no site (/slug ou /loja/token). */
  path: string;
  logoUrl: string | null;
  official: boolean;
  categories: Record<string, MatchCountInput>;
}

export interface ShopMatchEmailCollection {
  /** Nome curto da coleção (catalog.shortName). */
  name: string;
  slug: string;
  missing: number;
  /** Só as categorias em que falta algo. */
  categories: { key: string; label: string }[];
  /** Lojas mais compatíveis, já ordenadas. */
  shops: ShopMatchEmailShop[];
  /** Total de lojas com algo do que falta (pode ser maior que shops.length). */
  totalShops: number;
  /** Lojas que têm TUDO o que falta nessa coleção. */
  fullShops: number;
}

export interface ShopMatchEmailInput {
  firstName?: string | null;
  collections: ShopMatchEmailCollection[];
  /** Lojas diferentes com algo do que falta, somando todas as coleções (inclui as que não aparecem). */
  shopCount: number;
}

/** Mesma regra do modal: com qualquer item, ao menos 1%. */
export const matchPct = (c: MatchCountInput) => (c.matched ? Math.max(1, Math.round((c.matched / c.missing) * 100)) : 0);

const link = (path: string, extra = "") => `${SITE}${path}${path.includes("?") ? "&" : "?"}${extra ? `${extra}&` : ""}${UTM}`;
const shopUrl = (s: ShopMatchEmailShop, c: ShopMatchEmailCollection) => link(s.path, `colecao=${encodeURIComponent(c.slug)}`);
/** Com lojas = true, a coleção abre já com "Lojas com o que falta" (o modal do Quero comprar). */
const collectionUrl = (c: ShopMatchEmailCollection, lojas = false) => link(`/colecao/${encodeURIComponent(c.slug)}`, lojas ? "lojas=1" : "");
const absolute = (u: string) => (u.startsWith("/") ? `${SITE}${u}` : u);
const isFull = (c: MatchCountInput) => c.missing > 0 && c.matched >= c.missing;
/** "todas as 27 que faltam" / "a figurinha que falta". */
const todas = (n: number) => (n === 1 ? "a figurinha que falta" : `todas as ${num(n)} que faltam`);

export function shopMatchSubject({ firstName, shopCount: lojas, collections }: ShopMatchEmailInput): string {
  const quem = firstName ? `${firstName}, ` : "";
  const c = collections[0];
  if (c?.fullShops) {
    const quantas = c.fullShops === 1 ? "uma loja tem" : `${c.fullShops} lojas têm`;
    const oQue = c.missing === 1 ? "a figurinha que falta" : "todas as figurinhas que faltam";
    return `${quem}${quantas} ${oQue} no seu ${c.name}`;
  }
  return lojas === 1
    ? `${quem}uma loja tem figurinhas que faltam na sua coleção`
    : `${quem}${lojas} lojas têm figurinhas que faltam na sua coleção`;
}

function preheader({ collections }: ShopMatchEmailInput): string {
  const c = collections[0];
  const s = c?.shops[0];
  if (!c || !s) return "Veja quais lojas têm o que falta para você.";
  if (isFull(s)) return `${s.name} tem ${todas(c.missing)} no seu ${c.name}. Dá para completar num pedido só.`;
  return `${s.name} tem ${num(s.matched)} das ${num(c.missing)} que faltam no seu ${c.name}.`;
}

function bar(label: string, count: MatchCountInput, main: boolean): string {
  const p = matchPct(count);
  const cor = count.matched ? GREEN : "#b9c8be";
  const fill =
    p > 0
      ? `<td width="${p}%" height="${main ? 10 : 6}" bgcolor="${GREEN}" style="background:${GREEN};font-size:0;line-height:0;">&nbsp;</td>`
      : "";
  const rest = p < 100 ? `<td height="${main ? 10 : 6}" bgcolor="${TRACK}" style="background:${TRACK};font-size:0;line-height:0;">&nbsp;</td>` : "";
  return `
                  <tr>
                    <td style="padding:${main ? "2px 0 10px" : "0 0 8px"};${FONT}">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="font-size:${main ? 14 : 13}px;line-height:18px;color:${main ? INK : "#3d5a48"};${main ? "font-weight:bold;" : ""}">${esc(label)}</td>
                          <td align="right" style="font-size:12px;line-height:18px;color:${MUTED};white-space:nowrap;">${num(count.matched)} de ${num(count.missing)}&nbsp;&nbsp;<b style="font-size:${main ? 15 : 13}px;color:${cor};">${p}%</b></td>
                        </tr>
                      </table>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;border-radius:999px;overflow:hidden;">
                        <tr>${fill}${rest}</tr>
                      </table>
                    </td>
                  </tr>`;
}

function fullRow(missing: number): string {
  return `
                  <tr>
                    <td style="padding:2px 0 10px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td bgcolor="#e8f5ec" style="background:#e8f5ec;border-radius:10px;padding:10px 12px;${FONT}font-size:15px;line-height:20px;font-weight:bold;color:${INK};">
                            <span style="color:${GREEN};">✓</span>&nbsp; Tem ${todas(missing)} para você
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`;
}

function logo(s: ShopMatchEmailShop): string {
  if (s.logoUrl) {
    return `<img src="${esc(absolute(s.logoUrl))}" width="48" height="48" alt="" style="display:block;border:0;width:48px;height:48px;border-radius:12px;object-fit:cover;">`;
  }
  const inicial = esc(s.name.trim().charAt(0).toUpperCase() || "L");
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="48" height="48" align="center" bgcolor="#e8f5ec" style="width:48px;height:48px;border-radius:12px;background:#e8f5ec;${FONT}font-size:22px;font-weight:bold;color:${GREEN};">${inicial}</td></tr></table>`;
}

function shopCard(s: ShopMatchEmailShop, c: ShopMatchEmailCollection): string {
  const tag = s.official
    ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:#fff4c2;font-size:11px;line-height:16px;font-weight:bold;color:#6b5400;vertical-align:middle;">Loja oficial</span>`
    : "";
  const full = isFull(s);
  const cats = full ? "" : c.categories.length > 1 ? c.categories.map((k) => bar(k.label, s.categories[k.key] ?? { matched: 0, missing: 0 }, false)).join("") : "";
  return `
          <tr>
            <td style="padding:0 32px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${TRACK};border-radius:14px;">
                <tr>
                  <td style="padding:16px 16px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="60" valign="middle">${logo(s)}</td>
                        <td valign="middle" style="${FONT}font-size:16px;line-height:22px;font-weight:bold;color:${INK};">${esc(s.name)}${tag}</td>
                        <td align="right" valign="middle" style="${FONT}white-space:nowrap;">
                          <a href="${esc(shopUrl(s, c))}" style="display:inline-block;padding:9px 16px;border-radius:999px;background:#fdca04;font-size:14px;line-height:16px;font-weight:bold;color:#06301a;text-decoration:none;">Ver loja</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 16px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${full ? fullRow(c.missing) : bar("Do que falta para você", s, true)}${cats}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function collectionBlock(c: ShopMatchEmailCollection): string {
  const mais = c.totalShops - c.shops.length;
  return `
          <tr>
            <td style="padding:22px 32px 12px;${FONT}">
              <div style="font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${GREEN};">Sua coleção</div>
              <div style="font-size:20px;line-height:26px;font-weight:bold;color:${INK};">${esc(c.name)}</div>
              <div style="font-size:14px;line-height:20px;color:${MUTED};">Faltam ${num(c.missing)} · ${
                c.fullShops
                  ? `${c.fullShops === 1 ? "1 loja tem" : `${num(c.fullShops)} lojas têm`} ${c.missing === 1 ? "ela" : "todas"}`
                  : `${c.totalShops === 1 ? "1 loja tem" : `${num(c.totalShops)} lojas têm`} parte delas`
              }</div>
            </td>
          </tr>${c.shops.map((s) => shopCard(s, c)).join("")}
          <tr>
            <td align="center" style="padding:2px 32px 8px;${FONT}font-size:14px;line-height:20px;">
              <a href="${esc(collectionUrl(c, mais > 0))}" style="color:#027a2c;font-weight:bold;">${mais > 0 ? `Ver mais ${num(mais)} ${mais === 1 ? "loja" : "lojas"} na sua coleção →` : "Abrir minha coleção →"}</a>
            </td>
          </tr>`;
}

export function shopMatchHtml(input: ShopMatchEmailInput): string {
  const ola = input.firstName ? `Olá, ${esc(input.firstName)}!` : "Olá!";
  const subject = shopMatchSubject(input);
  const lojas = input.shopCount;
  const completa = input.collections.reduce((n, c) => n + c.fullShops, 0);
  const parcial = input.collections.some((c) => c.shops.some((s) => !isFull(s)));
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader(input))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f2;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td align="center" style="background:${GREEN};padding:28px 24px 24px;">
            <a href="${link("/")}" style="text-decoration:none;">
              <img src="${SITE}/brand/gn-coleciona-logo-email.png" width="150" height="78" alt="${PLATFORM_NAME}" style="display:block;border:0;width:150px;height:auto;">
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 4px;${FONT}">
            <h1 style="margin:0 0 14px;font-size:26px;line-height:32px;color:${INK};">${ola} Encontramos o que falta na sua coleção.</h1>
            <p style="margin:0;font-size:16px;line-height:24px;color:#3d5a48;">
              Cruzamos as figurinhas que você ainda não tem com o estoque das lojas da ${PLATFORM_NAME}. ${lojas === 1 ? "Uma loja tem" : `${num(lojas)} lojas têm`} o que você procura${
                completa === 0 ? "" : completa === 1 ? " — numa delas, dá para completar tudo num pedido só" : " — em algumas, dá para completar tudo num pedido só"
              }. Abaixo, as que mais têm${parcial ? "; a porcentagem mostra quanto do que falta cada uma resolve" : ""}.
            </p>
          </td>
        </tr>${input.collections.map(collectionBlock).join("")}
        <tr>
          <td style="padding:18px 32px 0;${FONT}">
            <p style="margin:0;font-size:14px;line-height:21px;color:${MUTED};">Na loja, escolha as figurinhas e mande o pedido: ele chega no WhatsApp do lojista, que combina pagamento e envio com você. O estoque muda o tempo todo — as porcentagens são de hoje.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 26px;${FONT}font-size:12px;line-height:18px;color:${MUTED};">
            <div style="border-top:1px solid ${TRACK};padding-top:18px;">Você recebeu este e-mail porque acompanha uma coleção na <a href="${link("/")}" style="color:#027a2c;">${PLATFORM_NAME}</a>. Para não receber mais avisos como este, responda este e-mail pedindo.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function shopMatchText(input: ShopMatchEmailInput): string {
  const linhas = [`${input.firstName ? `Olá, ${input.firstName}!` : "Olá!"} Encontramos o que falta na sua coleção.`, ""];
  for (const c of input.collections) {
    linhas.push(`${c.name} — faltam ${num(c.missing)}`);
    for (const s of c.shops) {
      if (isFull(s)) {
        linhas.push(`- ${s.name}${s.official ? " (loja oficial)" : ""}: tem ${todas(c.missing)}`, `  ${shopUrl(s, c)}`);
        continue;
      }
      linhas.push(`- ${s.name}${s.official ? " (loja oficial)" : ""}: ${num(s.matched)} de ${num(c.missing)} (${matchPct(s)}%)`);
      if (c.categories.length > 1) {
        for (const k of c.categories) {
          const m = s.categories[k.key] ?? { matched: 0, missing: 0 };
          linhas.push(`    ${k.label}: ${num(m.matched)} de ${num(m.missing)} (${matchPct(m)}%)`);
        }
      }
      linhas.push(`  ${shopUrl(s, c)}`);
    }
    linhas.push(`Todas as lojas com o que falta: ${collectionUrl(c, true)}`, "");
  }
  linhas.push(
    "Na loja, escolha as figurinhas e mande o pedido: ele chega no WhatsApp do lojista, que combina pagamento e envio com você.",
    "",
    `Você recebeu este e-mail porque acompanha uma coleção na ${PLATFORM_NAME} (${SITE}). Para não receber mais avisos como este, responda este e-mail pedindo.`
  );
  return linhas.join("\n");
}
