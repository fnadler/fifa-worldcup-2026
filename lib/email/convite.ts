import { PLATFORM_NAME } from "../brand";

// Convite para quem começou o cadastro e não confirmou o e-mail (até nov/2026 o cadastro pedia a
// confirmação por link, e um terço parava aí). Chama para criar a coleção grátis e oferece a loja para vender
// as repetidas. Os dois botões entram na conta direto (link de entrada, ver lib/linkEntrada.ts).
// HTML em tabelas com estilo inline + versão em texto, como os outros e-mails da base.

const SITE = "https://www.gncoleciona.com.br";
const GREEN = "#029838";
const INK = "#0b2a17";
const MUTED = "#5b7566";
const FONT = "font-family:Arial,Helvetica,sans-serif;";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface ConviteInput {
  firstName?: string | null;
  /** Link que entra na conta e abre a escolha das coleções (colecionar). */
  linkColecao: string;
  /** Link que entra na conta e abre a escolha das coleções para vender (loja). */
  linkLoja: string;
  /** Lojas abertas hoje (prova social do "quem vende o que falta"). */
  shopCount: number;
  trialDays: number;
}

export function conviteSubject({ firstName }: ConviteInput): string {
  return `${firstName ? `${firstName}, s` : "S"}ua coleção grátis da Copa 2026 está esperando`;
}

const PREHEADER = "Marque o que você tem, veja o que falta e, se quiser, venda as repetidas. É grátis e leva 1 minuto.";

function intro(): string {
  return `Você começou o cadastro na ${PLATFORM_NAME}, mas ele não chegou ao fim. Guardamos tudo: é só tocar no botão abaixo que a sua conta abre na hora, sem senha e sem precisar confirmar mais nada.`;
}

function vantagens({ shopCount }: ConviteInput): [string, string][] {
  return [
    ["Grátis, para sempre", "Criar e organizar a coleção não custa nada. Álbum da Copa 2026, Adrenalyn XL, Gold Crumple e os álbuns das Copas de 1990 a 2022."],
    ["Saiba na hora o que falta", "Um toque em cada figurinha que você tem. A lista do que falta e a das repetidas saem sozinhas, prontas para trocar."],
    [
      "Complete mais rápido",
      `O botão Quero completar mostra quais das ${shopCount} lojas da plataforma vendem o que falta para você.`,
    ],
  ];
}

export function conviteHtml(input: ConviteInput): string {
  const ola = input.firstName ? `Olá, ${esc(input.firstName)}!` : "Olá!";
  const colecao = esc(input.linkColecao);
  const loja = esc(input.linkLoja);
  const itens = vantagens(input)
    .map(
      ([t, x]) => `
          <tr>
            <td width="34" valign="top" style="padding:0 0 16px;${FONT}font-size:18px;line-height:22px;color:${GREEN};font-weight:bold;">✓</td>
            <td valign="top" style="padding:0 0 16px;${FONT}">
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
<title>${esc(conviteSubject(input))}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${PREHEADER}</div>
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
            <h1 style="margin:0 0 14px;font-size:26px;line-height:32px;color:${INK};">${ola} Sua coleção grátis está esperando.</h1>
            <p style="margin:0;font-size:16px;line-height:24px;color:#3d5a48;">${intro()}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 32px 2px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itens}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:6px 32px 30px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="#fdca04" style="border-radius:999px;">
                  <a href="${colecao}" style="display:inline-block;padding:16px 34px;${FONT}font-size:17px;line-height:20px;font-weight:bold;color:#06301a;text-decoration:none;">Criar minha coleção grátis</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5ec;border-radius:14px;">
              <tr>
                <td style="padding:22px 22px 8px;${FONT}">
                  <div style="font-size:12px;line-height:16px;letter-spacing:1px;text-transform:uppercase;font-weight:bold;color:${GREEN};">Tem repetidas paradas?</div>
                  <div style="margin-top:6px;font-size:20px;line-height:26px;font-weight:bold;color:${INK};">Transforme as repetidas em dinheiro</div>
                  <p style="margin:8px 0 0;font-size:15px;line-height:22px;color:#3d5a48;">Abra a sua loja com link próprio: foto de cada figurinha, preço do seu jeito e os pedidos direto no seu WhatsApp. O estoque sai das repetidas que você marcar. ${input.trialDays} dias grátis para testar.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 22px 22px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="border-radius:999px;border:2px solid ${GREEN};">
                        <a href="${loja}" style="display:inline-block;padding:12px 26px;${FONT}font-size:16px;line-height:20px;font-weight:bold;color:${GREEN};text-decoration:none;">Quero vender minhas repetidas</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 26px;border-top:1px solid #e1e9e3;${FONT}font-size:12px;line-height:18px;color:${MUTED};">
            Você recebeu este e-mail porque começou um cadastro na ${PLATFORM_NAME} com este endereço. Os botões entram na sua conta e valem por 14 dias. Se não foi você, ignore este e-mail. Para não receber mais avisos como este, responda pedindo.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function conviteText(input: ConviteInput): string {
  return [
    `${input.firstName ? `Olá, ${input.firstName}!` : "Olá!"} Sua coleção grátis está esperando.`,
    "",
    intro(),
    "",
    ...vantagens(input).map(([t, x]) => `- ${t}: ${x}`),
    "",
    `Criar minha coleção grátis: ${input.linkColecao}`,
    "",
    `Tem repetidas paradas? Abra a sua loja com link próprio, preço do seu jeito e pedidos no WhatsApp. ${input.trialDays} dias grátis para testar.`,
    `Quero vender minhas repetidas: ${input.linkLoja}`,
    "",
    `Você recebeu este e-mail porque começou um cadastro na ${PLATFORM_NAME} (${SITE}) com este endereço. Os links entram na sua conta e valem por 14 dias. Se não foi você, ignore este e-mail. Para não receber mais avisos como este, responda pedindo.`,
  ].join("\n");
}
