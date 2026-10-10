import "server-only";

// Envio de e-mail pelo Resend (https://resend.com), direto pela API — sem dependência.
// RESEND_API_KEY: chave da conta; EMAIL_FROM: remetente de um domínio verificado no Resend.

const FROM_PADRAO = "GN Coleciona <comunidade@gncoleciona.com.br>";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Envia um e-mail. Devolve o id do Resend, ou lança com a mensagem de erro. */
export async function sendEmail(msg: EmailMessage): Promise<string> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || FROM_PADRAO, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(body.message || `Resend respondeu ${res.status}`);
  return body.id;
}
