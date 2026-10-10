// Gera os modelos de e-mail de autenticação do Supabase (confirmar cadastro e recuperar senha) com a cara
// da plataforma — o mesmo layout do convite da comunidade (lib/email/communityInvite.ts).
//
// O Supabase não lê arquivos do projeto: copie o conteúdo de cada .html gerado em emails/ e cole em
// Authentication → Emails → Templates, junto com o assunto indicado no topo do arquivo.
// As marcas {{ .Algo }} são variáveis do Supabase, preenchidas na hora do envio.
//
// Uso: node scripts/build-auth-emails.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE = "https://www.gncoleciona.com.br";
const GREEN = "#029838";
const INK = "#0b2a17";
const MUTED = "#5b7566";
const FONT = "font-family:Arial,Helvetica,sans-serif;";

function layout({ subject, preheader, title, paragraphs, button, url, note }) {
  return `<!-- Assunto (Subject): ${subject} -->
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f2;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td align="center" style="background:${GREEN};padding:28px 24px 24px;">
            <a href="${SITE}" style="text-decoration:none;">
              <img src="${SITE}/brand/gn-coleciona-logo-email.png" width="150" height="78" alt="GN Coleciona" style="display:block;border:0;width:150px;height:auto;">
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 6px;${FONT}">
            <h1 style="margin:0 0 14px;font-size:26px;line-height:32px;color:${INK};">${title}</h1>
${paragraphs.map((p) => `            <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#3d5a48;">${p}</p>`).join("\n")}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:8px 32px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="#fdca04" style="border-radius:999px;">
                  <a href="${url}" style="display:inline-block;padding:16px 34px;${FONT}font-size:17px;line-height:20px;font-weight:bold;color:#06301a;text-decoration:none;">${button}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 32px 26px;${FONT}font-size:13px;line-height:20px;color:${MUTED};">
            Se o botão não abrir, copie este endereço e cole no navegador:<br>
            <a href="${url}" style="color:#027a2c;word-break:break-all;">${url}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 26px;border-top:1px solid #e1e9e3;${FONT}font-size:12px;line-height:18px;color:${MUTED};">
            ${note}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

const emails = {
  // Authentication → Emails → Templates → "Reset password"
  // token_hash: o link abre em qualquer aparelho (app/auth/confirm).
  "supabase-recuperar-senha.html": layout({
    subject: "Crie uma senha nova — GN Coleciona",
    preheader: "O link para escolher sua senha nova vale por 1 hora.",
    title: "Vamos criar uma senha nova?",
    paragraphs: [
      "Recebemos um pedido para redefinir a senha da conta <strong>{{ .Email }}</strong> na GN Coleciona.",
      "Clique no botão abaixo para escolher uma senha nova. Sua coleção continua do jeito que você deixou.",
    ],
    button: "Criar senha nova",
    url: "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/login/nova-senha",
    note: "O link vale por 1 hora e só pode ser usado uma vez. Se não foi você quem pediu, é só ignorar este e-mail: sua senha continua a mesma.",
  }),

  // Authentication → Emails → Templates → "Confirm signup"
  // ConfirmationURL: mantém o destino escolhido no cadastro (ex: /assinar) e passa por /auth/callback.
  "supabase-confirmar-cadastro.html": layout({
    subject: "Confirme seu e-mail — GN Coleciona",
    preheader: "Falta só um clique para começar a sua coleção.",
    title: "Falta só um clique para começar",
    paragraphs: [
      "Que bom ter você na GN Coleciona! Confirme o seu e-mail para ativar a conta.",
      "Depois é só marcar as figurinhas e os cards que você já tem: a plataforma mostra na hora o que falta e o que sobra.",
    ],
    button: "Confirmar meu e-mail",
    url: "{{ .ConfirmationURL }}",
    note: "Você recebeu este e-mail porque alguém criou uma conta na GN Coleciona com este endereço. Se não foi você, é só ignorar: nenhuma conta será ativada.",
  }),
};

await mkdir(path.join(ROOT, "emails"), { recursive: true });
for (const [file, html] of Object.entries(emails)) {
  await writeFile(path.join(ROOT, "emails", file), html);
  console.log(`emails/${file}`);
}
