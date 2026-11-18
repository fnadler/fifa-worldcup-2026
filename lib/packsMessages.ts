// Textos do aviso "seus pacotes estão prontos" (WhatsApp do lojista e e-mail). Vale no cliente e no servidor.

export const SITE = "https://www.gncoleciona.com.br";

/** Link dos pacotes do pedido (/pacote/<token>). */
export const packsUrl = (token: string) => `${SITE}/pacote/${token}`;

const pad = (n: number) => String(n).padStart(2, "0");
export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

export interface PacksNotice {
  buyerName: string;
  code: string;
  token: string;
  numbers: number[];
  shopName: string;
}

export const packsCountText = (n: number) => (n === 1 ? "seu Pacote Legends está pronto" : `seus ${n} Pacotes Legends estão prontos`);

export function packsWhatsappText(n: PacksNotice): string {
  const nome = firstName(n.buyerName);
  return [
    `Oi${nome ? `, ${nome}` : ""}! Recebemos o seu pagamento do pedido *#${n.code}*. ✅`,
    "",
    `${packsCountText(n.numbers.length).replace(/^./, (c) => c.toUpperCase())} para abrir (nº ${n.numbers.map(pad).join(", ")}):`,
    packsUrl(n.token),
    "",
    "Cada pacote tem 7 figurinhas da Copa 2026 e mais 1 Legend. Depois de abrir, separamos tudo e enviamos pelo correio.",
  ].join("\n");
}
