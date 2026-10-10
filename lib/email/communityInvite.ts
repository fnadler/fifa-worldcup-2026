import { PLATFORM_NAME } from "../brand";

// E-mail de convite para o grupo de WhatsApp da comunidade. HTML em tabelas com estilo inline
// (é o que os programas de e-mail entendem) + versão em texto.

const SITE = "https://www.gncoleciona.com.br";
const GREEN = "#029838"; // o mesmo verde do fundo do logo (public/brand/gn-coleciona-logo-email.png)
const INK = "#0b2a17";
const MUTED = "#5b7566";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface CommunityInviteInput {
  /** Primeiro nome, se houver (user_metadata.full_name). */
  firstName?: string | null;
  groupUrl: string;
}

export const communityInviteSubject = "Seu convite para a comunidade GN Coleciona no WhatsApp";

const BENEFITS = [
  ["🔁", "Troque repetidas", "Ache quem tem a figurinha que falta para você — e quem precisa das suas."],
  ["🛒", "Compre e venda", "Fique sabendo primeiro das lojas e das raridades que entram na plataforma."],
  ["📣", "Novidades em primeira mão", "Novas coleções e recursos chegam antes no grupo."],
] as const;

export function communityInviteHtml({ firstName, groupUrl }: CommunityInviteInput): string {
  const ola = firstName ? `Olá, ${esc(firstName)}!` : "Olá!";
  const url = esc(groupUrl);
  const benefits = BENEFITS.map(
    ([emoji, title, text]) => `
          <tr>
            <td width="44" valign="top" style="padding:0 0 18px;font-size:24px;line-height:28px;">${emoji}</td>
            <td valign="top" style="padding:0 0 18px;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:16px;line-height:22px;font-weight:bold;color:${INK};">${title}</div>
              <div style="font-size:15px;line-height:22px;color:${MUTED};">${text}</div>
            </td>
          </tr>`
  ).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(communityInviteSubject)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Trocas, vendas e novidades com outros colecionadores — entre no grupo.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f2;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td align="center" style="background:${GREEN};padding:28px 24px 24px;">
            <a href="${SITE}" style="text-decoration:none;">
              <img src="${SITE}/brand/gn-coleciona-logo-email.png" width="150" height="78" alt="${PLATFORM_NAME}" style="display:block;border:0;width:150px;height:auto;">
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0 0 14px;font-size:26px;line-height:32px;color:${INK};">${ola} Você está convidado para a nossa comunidade.</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:#3d5a48;">
              Criamos um grupo de WhatsApp só para quem coleciona pela ${PLATFORM_NAME}. É o lugar para fechar trocas, achar aquela figurinha difícil e acompanhar o que há de novo.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${benefits}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:10px 32px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="#25D366" style="border-radius:999px;">
                  <a href="${url}" style="display:inline-block;padding:16px 34px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:20px;font-weight:bold;color:#06301a;text-decoration:none;">Entrar no grupo do WhatsApp</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 30px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${MUTED};">
            Se o botão não abrir, copie este endereço:<br>
            <a href="${url}" style="color:#027a2c;word-break:break-all;">${url}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 26px;border-top:1px solid #e1e9e3;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${MUTED};">
            Você recebeu este e-mail porque criou uma conta na <a href="${SITE}" style="color:#027a2c;">${PLATFORM_NAME}</a>. É um convite único — entrar no grupo é opcional e você pode sair quando quiser.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function communityInviteText({ firstName, groupUrl }: CommunityInviteInput): string {
  return [
    `${firstName ? `Olá, ${firstName}!` : "Olá!"} Você está convidado para a nossa comunidade.`,
    "",
    `Criamos um grupo de WhatsApp só para quem coleciona pela ${PLATFORM_NAME}. É o lugar para fechar trocas, achar aquela figurinha difícil e acompanhar o que há de novo.`,
    "",
    ...BENEFITS.map(([, title, text]) => `- ${title}: ${text}`),
    "",
    `Entrar no grupo: ${groupUrl}`,
    "",
    `Você recebeu este e-mail porque criou uma conta na ${PLATFORM_NAME} (${SITE}). É um convite único — entrar no grupo é opcional e você pode sair quando quiser.`,
  ].join("\n");
}
