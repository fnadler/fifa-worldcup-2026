import { PLATFORM_NAME } from "../brand";

// E-mail para quem tem muitas repetidas e ainda não tem loja: quantas são, quanto podem valer pelo preço médio das
// lojas da plataforma e como a loja funciona. Duas versões: com teste grátis (nunca assinou) e sem (já assinou
// e cancelou: o teste é só na primeira assinatura). HTML em tabelas com estilo inline + versão em texto.

const SITE = "https://www.gncoleciona.com.br";
const GREEN = "#029838";
const INK = "#0b2a17";
const MUTED = "#5b7566";
const FONT = "font-family:Arial,Helvetica,sans-serif;";
const UTM = "utm_source=email&utm_medium=email&utm_campaign=repetidas_loja";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = (path: string) => `${SITE}${path}${path.includes("?") ? "&" : "?"}${UTM}`;

export interface RepetidasEmailInput {
  firstName?: string | null;
  /** Total de repetidas (todas as coleções). */
  repetidas: number;
  /** Valor estimado, já formatado ("R$ 4.300"), ou null sem preço de referência. */
  valor: string | null;
  /** Coleção com mais repetidas (para o link "ver como funciona"). */
  colecao: { name: string; slug: string };
  /** 0 = já assinou antes (sem teste grátis). */
  trialDays: number;
}

const n = (x: number) => x.toLocaleString("pt-BR");

export function repetidasSubject({ firstName, repetidas, valor }: RepetidasEmailInput): string {
  const quem = firstName ? `${firstName}, s` : "S";
  return valor ? `${quem}uas ${n(repetidas)} repetidas podem valer até ${valor}` : `${quem}uas ${n(repetidas)} repetidas podem virar dinheiro`;
}

function intro({ repetidas, valor, colecao }: RepetidasEmailInput): string {
  const quanto = valor ? `, que podem valer até <strong>${esc(valor)}</strong> pelo preço médio das lojas da plataforma` : "";
  return `Você já marcou <strong>${n(repetidas)} repetidas</strong> na sua coleção (a maior parte no ${esc(colecao.name)})${quanto}. Hoje elas estão paradas. Com uma loja na ${PLATFORM_NAME}, elas viram vendas:`;
}

function passos({ trialDays }: RepetidasEmailInput): [string, string, string][] {
  return [
    ["1", "O catálogo já está pronto", "A loja usa as repetidas que você marcou: cada figurinha com foto, e o estoque baixa sozinho a cada venda."],
    ["2", "Você define os preços", "Um preço por grupo (seleções, escudos, especiais) ou individual para as mais valiosas. Pedido mínimo, se quiser."],
    [
      "3",
      "Os pedidos chegam no seu WhatsApp",
      trialDays > 0
        ? `Link próprio para divulgar e o carrinho reserva os itens. ${trialDays} dias grátis para testar, cancele quando quiser.`
        : "Link próprio para divulgar e o carrinho reserva os itens. Cancele quando quiser, sem multa.",
    ],
  ];
}

const ctaLabel = ({ trialDays }: RepetidasEmailInput) => (trialDays > 0 ? `Abrir minha loja — ${trialDays} dias grátis` : "Abrir minha loja");
const ctaUrl = () => url("/assinar");
const guiaUrl = ({ colecao }: RepetidasEmailInput) => url(`/colecao/${encodeURIComponent(colecao.slug)}?guia=loja`);

export function repetidasHtml(input: RepetidasEmailInput): string {
  const ola = input.firstName ? `Olá, ${esc(input.firstName)}!` : "Olá!";
  const titulo = input.valor ? `Suas repetidas podem valer até ${esc(input.valor)}.` : "Suas repetidas podem virar dinheiro.";
  const lista = passos(input)
    .map(
      ([num, t, x]) => `
          <tr>
            <td width="44" valign="top" style="padding:0 0 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="30" height="30" align="center" bgcolor="#e8f5ec" style="width:30px;height:30px;border-radius:999px;background:#e8f5ec;${FONT}font-size:15px;font-weight:bold;color:${GREEN};">${num}</td></tr></table>
            </td>
            <td valign="top" style="padding:3px 0 18px;${FONT}">
              <div style="font-size:16px;line-height:22px;font-weight:bold;color:${INK};">${t}</div>
              <div style="font-size:15px;line-height:22px;color:${MUTED};">${x}</div>
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
<title>${esc(repetidasSubject(input))}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">O catálogo da sua loja já está pronto: são as repetidas que você marcou.</div>
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
        </tr>
        <tr>
          <td style="padding:6px 32px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lista}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:6px 32px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="#fdca04" style="border-radius:999px;">
                  <a href="${esc(ctaUrl())}" style="display:inline-block;padding:16px 34px;${FONT}font-size:17px;line-height:20px;font-weight:bold;color:#06301a;text-decoration:none;">${ctaLabel(input)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 28px;${FONT}font-size:14px;line-height:20px;">
            <a href="${esc(guiaUrl(input))}" style="color:${GREEN};">Ver o passo a passo da loja</a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 26px;border-top:1px solid #e1e9e3;${FONT}font-size:12px;line-height:18px;color:${MUTED};">
            Você recebeu este e-mail porque tem uma conta na ${PLATFORM_NAME}. O valor é uma estimativa pelo preço médio que as lojas da plataforma cobram hoje. Para não receber mais avisos como este, responda este e-mail pedindo.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function repetidasText(input: RepetidasEmailInput): string {
  const titulo = input.valor ? `Suas repetidas podem valer até ${input.valor}.` : "Suas repetidas podem virar dinheiro.";
  return [
    `${input.firstName ? `Olá, ${input.firstName}!` : "Olá!"} ${titulo}`,
    "",
    intro(input).replace(/<\/?strong>/g, ""),
    "",
    ...passos(input).map(([num, t, x]) => `${num}. ${t}: ${x}`),
    "",
    `${ctaLabel(input)}: ${ctaUrl()}`,
    `Ver o passo a passo da loja: ${guiaUrl(input)}`,
    "",
    `Você recebeu este e-mail porque tem uma conta na ${PLATFORM_NAME} (${SITE}). O valor é uma estimativa pelo preço médio que as lojas da plataforma cobram hoje. Para não receber mais avisos como este, responda este e-mail pedindo.`,
  ].join("\n");
}
