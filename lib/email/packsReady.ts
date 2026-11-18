import { PLATFORM_NAME } from "../brand";
import { SITE, firstName, packsCountText, packsUrl, type PacksNotice } from "../packsMessages";

// E-mail "seus pacotes estão prontos para abrir", enviado quando a loja confirma o pagamento de um pedido
// de pacotes. HTML em tabelas com estilo inline + versão em texto (mesmo padrão dos outros e-mails).

const GREEN = "#029838";
const INK = "#0b2a17";
const MUTED = "#5b7566";
const LINE = "#e1e9e3";
const FONT = "font-family:Arial,Helvetica,sans-serif;";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n: number) => String(n).padStart(2, "0");

/** `closed`: lembrete — quantos pacotes do pedido ainda estão fechados. */
export function packsReadySubject(n: PacksNotice, closed?: number): string {
  const nome = firstName(n.buyerName);
  if (closed) return `${nome ? `${nome}, v` : "V"}ocê ainda tem ${closed === 1 ? "1 pacote fechado" : `${closed} pacotes fechados`}`;
  const frase = packsCountText(n.numbers.length);
  return `${nome ? `${nome}, ` : ""}${frase} para abrir`;
}

export function packsReadyHtml(n: PacksNotice, closed?: number): string {
  const nome = firstName(n.buyerName);
  const url = packsUrl(n.token);
  const qtd = closed || n.numbers.length;
  const nums = n.numbers.map(pad).join(", ");
  const titulo = closed ? "Sua Legend está esperando!" : "Pagamento confirmado!";
  const texto = closed
    ? `${nome ? `${esc(nome)}, ` : ""}você ainda tem ${closed === 1 ? "1 Pacote Legends fechado" : `${closed} Pacotes Legends fechados`} do pedido #${esc(n.code)}. A Legend de cada pacote é sorteada na hora em que você abre: abra agora e descubra quais vieram.`
    : `${nome ? `${esc(nome)}, ` : ""}${qtd === 1 ? "o seu Pacote Legends" : `os seus ${qtd} Pacotes Legends`} (nº ${nums}) ${qtd === 1 ? "está pronto" : "estão prontos"} para abrir. Cada pacote tem 7 figurinhas da Copa 2026 e mais 1 Legend, que você descobre na hora em que abrir.`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(packsReadySubject(n, closed))}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${closed ? "Seus pacotes continuam fechados." : "Pagamento confirmado."} Abra agora e descubra quais Legends vieram.</div>
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
            <div style="font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${GREEN};">Pedido #${esc(n.code)} · ${esc(n.shopName)}</div>
            <h1 style="margin:8px 0 14px;font-size:28px;line-height:34px;color:${INK};">${titulo}</h1>
            <p style="margin:0 0 10px;font-size:16px;line-height:24px;color:#3d5a48;">
              ${texto}
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:14px 32px 10px;${FONT}">
            <a href="${esc(url)}" style="display:inline-block;padding:15px 30px;border-radius:999px;background:#fdca04;font-size:17px;line-height:20px;font-weight:bold;color:#06301a;text-decoration:none;">Abrir meus pacotes</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 32px 0;${FONT}">
            <p style="margin:0;font-size:14px;line-height:21px;color:${MUTED};">
              Depois de abrir, a loja separa as figurinhas e envia para o seu endereço. Guarde este e-mail: o link continua valendo para você rever o que veio em cada pacote.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 26px;${FONT}font-size:12px;line-height:18px;color:${MUTED};">
            <div style="border-top:1px solid ${LINE};padding-top:18px;">Se o botão não funcionar, copie este endereço no navegador:<br><a href="${esc(url)}" style="color:#027a2c;word-break:break-all;">${esc(url)}</a></div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function packsReadyText(n: PacksNotice, closed?: number): string {
  const nome = firstName(n.buyerName);
  const qtd = n.numbers.length;
  if (closed) {
    return [
      `${nome ? `${nome}, v` : "V"}ocê ainda tem ${closed === 1 ? "1 Pacote Legends fechado" : `${closed} Pacotes Legends fechados`} do pedido #${n.code} · ${n.shopName}.`,
      "",
      "A Legend de cada pacote é sorteada na hora em que você abre. Abra agora:",
      packsUrl(n.token),
    ].join("\n");
  }
  return [
    `${nome ? `${nome}, p` : "P"}agamento confirmado! Pedido #${n.code} · ${n.shopName}`,
    "",
    `${qtd === 1 ? "O seu Pacote Legends" : `Os seus ${qtd} Pacotes Legends`} (nº ${n.numbers.map(pad).join(", ")}) ${qtd === 1 ? "está pronto" : "estão prontos"} para abrir:`,
    packsUrl(n.token),
    "",
    "Cada pacote tem 7 figurinhas da Copa 2026 e mais 1 Legend, que você descobre na hora em que abrir. Depois de abrir, a loja separa as figurinhas e envia para o seu endereço.",
  ].join("\n");
}
