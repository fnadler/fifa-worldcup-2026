import { PLATFORM_NAME } from "../brand";

// E-mail de ativação para quem criou a conta e ainda não marcou nenhum item. Duas versões: quem já escolheu
// uma coleção (vai direto para ela) e quem nem escolheu (vai para a escolha da coleção). HTML em tabelas com
// estilo inline + versão em texto.

const SITE = "https://www.gncoleciona.com.br";
const GREEN = "#029838";
const INK = "#0b2a17";
const MUTED = "#5b7566";
const FONT = "font-family:Arial,Helvetica,sans-serif;";
const UTM = "utm_source=email&utm_medium=email&utm_campaign=ativacao";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ActivationEmailInput {
  firstName?: string | null;
  /** A coleção que a pessoa escolheu (a primeira), se escolheu. */
  collection: { name: string; slug: string; total: number; itemPlural: string; coverUrl: string | null } | null;
  /** Lojas abertas com itens à venda hoje. */
  shopCount: number;
}

const url = (path: string) => `${SITE}${path}${path.includes("?") ? "&" : "?"}${UTM}`;
const ctaUrl = ({ collection }: ActivationEmailInput) => url(collection ? `/colecao/${encodeURIComponent(collection.slug)}` : "/colecoes/comecar");
const ctaLabel = ({ collection }: ActivationEmailInput) => (collection ? "Marcar minhas figurinhas" : "Escolher minha coleção");

export function activationSubject({ firstName, collection }: ActivationEmailInput): string {
  const quem = firstName ? `${firstName}, ` : "";
  return collection ? `${quem}seu ${collection.name} ainda está em branco` : `${quem}falta só escolher o que você coleciona`;
}

function preheader({ collection, shopCount }: ActivationEmailInput): string {
  return collection
    ? `Marque o que você já tem e veja na hora o que falta — e quais das ${shopCount} lojas vendem.`
    : "Copa 2026, Legends, Gold Crumple e as Copas de 1990 a 2022 — escolha a sua e comece a marcar.";
}

function intro({ collection }: ActivationEmailInput): string {
  return collection
    ? `Você criou sua conta e escolheu o ${esc(collection.name)}, mas ainda não marcou nenhuma figurinha. Leva poucos minutos e, a partir daí, a plataforma trabalha para você:`
    : `Sua conta na ${PLATFORM_NAME} está pronta, mas você ainda não escolheu o que coleciona. Tem o álbum da Copa 2026, as Legends, a Gold Crumple, o Adrenalyn XL e os álbuns das Copas de 1990 a 2022. Escolha o seu e:`;
}

function steps({ shopCount }: ActivationEmailInput): [string, string, string][] {
  return [
    ["1", "Marque o que você já tem", "Um toque em cada figurinha que você tem. Tocou de novo, virou repetida."],
    [
      "2",
      "Veja o que falta — e quem vende",
      `A lista do que falta sai na hora, e o botão Quero completar mostra quais das ${shopCount} lojas da plataforma têm. Em várias, dá para completar tudo num pedido só.`,
    ],
    ["3", "Suas repetidas viram dinheiro", "Se quiser, abra uma loja com as repetidas. Os pedidos chegam no seu WhatsApp."],
  ];
}

export function activationHtml(input: ActivationEmailInput): string {
  const ola = input.firstName ? `Olá, ${esc(input.firstName)}!` : "Olá!";
  const titulo = input.collection ? `Seu ${esc(input.collection.name)} ainda está em branco.` : "Falta só escolher o que você coleciona.";
  const cta = esc(ctaUrl(input));
  const capa = input.collection?.coverUrl
    ? `
        <tr>
          <td align="center" style="padding:4px 32px 18px;">
            <a href="${cta}"><img src="${esc(input.collection.coverUrl)}" width="200" alt="${esc(input.collection.name)}" style="display:block;border:0;width:200px;max-width:100%;height:auto;border-radius:10px;"></a>
          </td>
        </tr>`
    : "";
  const passos = steps(input)
    .map(
      ([n, title, text]) => `
          <tr>
            <td width="44" valign="top" style="padding:0 0 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="30" height="30" align="center" bgcolor="#e8f5ec" style="width:30px;height:30px;border-radius:999px;background:#e8f5ec;${FONT}font-size:15px;font-weight:bold;color:${GREEN};">${n}</td></tr></table>
            </td>
            <td valign="top" style="padding:3px 0 18px;${FONT}">
              <div style="font-size:16px;line-height:22px;font-weight:bold;color:${INK};">${title}</div>
              <div style="font-size:15px;line-height:22px;color:${MUTED};">${text}</div>
            </td>
          </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(activationSubject(input))}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader(input))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f2;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td align="center" style="background:${GREEN};padding:28px 24px 24px;">
            <img src="${SITE}/brand/gn-coleciona-logo-email.png" width="150" height="78" alt="${PLATFORM_NAME}" style="display:block;border:0;width:150px;height:auto;">
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 18px;${FONT}">
            <h1 style="margin:0 0 14px;font-size:26px;line-height:32px;color:${INK};">${ola} ${titulo}</h1>
            <p style="margin:0;font-size:16px;line-height:24px;color:#3d5a48;">${intro(input)}</p>
          </td>
        </tr>${capa}
        <tr>
          <td style="padding:0 32px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${passos}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:6px 32px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="#fdca04" style="border-radius:999px;">
                  <a href="${cta}" style="display:inline-block;padding:16px 34px;${FONT}font-size:17px;line-height:20px;font-weight:bold;color:#06301a;text-decoration:none;">${ctaLabel(input)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 26px;border-top:1px solid #e1e9e3;${FONT}font-size:12px;line-height:18px;color:${MUTED};">
            Você recebeu este e-mail porque criou uma conta na ${PLATFORM_NAME}. A conta é grátis para colecionar. Para não receber mais avisos como este, responda este e-mail pedindo.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function activationText(input: ActivationEmailInput): string {
  const titulo = input.collection ? `Seu ${input.collection.name} ainda está em branco.` : "Falta só escolher o que você coleciona.";
  const intro = input.collection
    ? `Você criou sua conta e escolheu o ${input.collection.name}, mas ainda não marcou nenhuma figurinha. Leva poucos minutos e, a partir daí, a plataforma trabalha para você:`
    : `Sua conta na ${PLATFORM_NAME} está pronta, mas você ainda não escolheu o que coleciona. Tem o álbum da Copa 2026, as Legends, a Gold Crumple, o Adrenalyn XL e os álbuns das Copas de 1990 a 2022. Escolha o seu e:`;
  return [
    `${input.firstName ? `Olá, ${input.firstName}!` : "Olá!"} ${titulo}`,
    "",
    intro,
    "",
    ...steps(input).map(([n, t, x]) => `${n}. ${t}: ${x}`),
    "",
    `${ctaLabel(input)}: ${ctaUrl(input)}`,
    "",
    `Você recebeu este e-mail porque criou uma conta na ${PLATFORM_NAME} (${SITE}). A conta é grátis para colecionar. Para não receber mais avisos como este, responda este e-mail pedindo.`,
  ].join("\n");
}
