import { PLATFORM_NAME } from "../brand";

// E-mail com o código de 6 dígitos que confirma o e-mail ao ativar o teste grátis da loja. Curto: o código
// em destaque, para quem lê pela notificação do celular.

const SITE = "https://www.gncoleciona.com.br";
const GREEN = "#029838";
const INK = "#0b2a17";
const MUTED = "#5b7566";
const FONT = "font-family:Arial,Helvetica,sans-serif;";

export const codigoSubject = (codigo: string) => `${codigo} é o seu código da ${PLATFORM_NAME}`;

export function codigoHtml(codigo: string, minutos: number): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${codigoSubject(codigo)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Digite o código na tela para ativar o teste grátis da sua loja.</div>
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
          <td style="padding:32px 32px 8px;${FONT}">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:30px;color:${INK};">Seu código para ativar a loja</h1>
            <p style="margin:0;font-size:16px;line-height:24px;color:#3d5a48;">Digite este código na tela da ${PLATFORM_NAME} para confirmar o seu e-mail e começar o teste grátis:</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:22px 32px;">
            <div style="display:inline-block;padding:14px 26px;border-radius:12px;background:#e8f5ec;${FONT}font-size:34px;line-height:40px;letter-spacing:8px;font-weight:bold;color:${GREEN};">${codigo}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;${FONT}font-size:14px;line-height:21px;color:${MUTED};">
            O código vale por ${minutos} minutos. Se não foi você que pediu, pode ignorar este e-mail.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function codigoText(codigo: string, minutos: number): string {
  return [
    `Seu código para ativar a loja na ${PLATFORM_NAME}: ${codigo}`,
    "",
    `Digite o código na tela para confirmar o seu e-mail e começar o teste grátis. Ele vale por ${minutos} minutos.`,
    "",
    "Se não foi você que pediu, pode ignorar este e-mail.",
  ].join("\n");
}
