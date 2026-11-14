// Mensagens do leilão para o grupo e para o privado, geradas a partir do cadastro de cada leilão
// (data, minutos por lote, prorrogação, incremento, Pix, frete). Formatação do WhatsApp: *negrito*.
// Sem dependências pesadas: roda no servidor (página do leilão) e no navegador (painel ao vivo).

import type { Auction, AuctionLot } from "./auctions";
import { PLATFORM_NAME } from "./brand";

const SP = "America/Sao_Paulo";
const BRAND = PLATFORM_NAME.toUpperCase();

/** Abertura antes do lote 1 e tempo médio por lote (rodada + prorrogações + troca de lote). */
export const OPENING_MINUTES = 10;
export const slotMinutes = (a: Pick<Auction, "lotMinutes">) => a.lotMinutes + 2;

export interface Bidder {
  name: string;
  whatsapp: string;
}

// ---------- formatos ----------

/** R$ 80 (sem centavos quando o valor é redondo) ou R$ 80,50. */
export function brl(cents: number): string {
  const v = cents / 100;
  return "R$ " + v.toLocaleString("pt-BR", Number.isInteger(v) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 18:30 no fuso de Brasília. */
export function hhmm(d: Date | string | number): string {
  return new Date(d).toLocaleTimeString("pt-BR", { timeZone: SP, hour: "2-digit", minute: "2-digit" });
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const minutos = (n: number) => plural(n, "minuto", "minutos");

/** "sábado, 14 de novembro" */
function dateLabel(a: Auction): string {
  return new Date(a.startsAt).toLocaleDateString("pt-BR", { timeZone: SP, weekday: "long", day: "numeric", month: "long" });
}

/** "18h30" */
function hourLabel(a: Auction): string {
  return hhmm(a.startsAt).replace(":", "h");
}

/** Horário previsto de abertura do lote de índice i (0 = primeiro). */
export function slotTime(a: Auction, i: number): string {
  return hhmm(new Date(a.startsAt).getTime() + (OPENING_MINUTES + i * slotMinutes(a)) * 60000);
}

/** Fim previsto do leilão. */
export function predictedEnd(a: Auction, lotCount: number): Date {
  return new Date(new Date(a.startsAt).getTime() + (OPENING_MINUTES + lotCount * slotMinutes(a)) * 60000);
}

/**
 * Prazo do Pix: o prazo do leilão (em horas) depois do fim previsto, arredondado para a hora cheia
 * seguinte. Ex.: "domingo, 15/11, às 21h".
 */
export function deadlineLabel(a: Auction, lotCount: number): string {
  const end = predictedEnd(a, lotCount).getTime();
  const hour = 3600000;
  const rounded = Math.ceil(end / hour) * hour; // Brasília é UTC−3: hora cheia em UTC = hora cheia local
  const d = new Date(rounded + a.pixDeadlineHours * hour);
  const day = d.toLocaleDateString("pt-BR", { timeZone: SP, weekday: "long", day: "2-digit", month: "2-digit" });
  const h = Number(d.toLocaleTimeString("pt-BR", { timeZone: SP, hour: "2-digit", hourCycle: "h23" }).slice(0, 2));
  return `${day}, às ${h}h`;
}

const pixLabel = (a: Auction) => a.pixKey || "[chave Pix]";
const shippingLabel = (a: Auction) => a.shippingNote || "[forma de envio]";
const prazoHoras = (a: Auction) => plural(a.pixDeadlineHours, "hora", "horas");

// ---------- antes do leilão ----------

export function rulesText(a: Auction, lotCount: number): string {
  const inc = a.minIncrementCents;
  return [
    `🔨 *LEILÃO ${BRAND} · REGRAS*`,
    "",
    `📅 ${dateLabel(a)}, às ${hourLabel(a)}, aqui no grupo`,
    `${plural(lotCount, "lote selecionado", "lotes selecionados")}, um de cada vez.`,
    "",
    "*Como funciona*",
    `1. Os lotes vão um por vez. Cada um aparece com foto e descrição quando abre e fica aberto por *${minutos(a.lotMinutes)}*.`,
    "2. Cada lote tem um lance inicial. O primeiro lance pode ser o próprio lance inicial.",
    `3. O incremento mínimo é de *${brl(inc)}*: cada lance precisa ser pelo menos ${brl(inc)} maior que o anterior. Se o maior lance é ${brl(inc * 12)}, o próximo tem que ser de ${brl(inc * 13)} ou mais. Quem quiser pode dar um lance maior, como ${brl(inc * 15)} ou ${brl(inc * 20)}. Lance abaixo do mínimo não vale.`,
    `4. Para dar lance, mande *só o número* aqui no grupo. Exemplo: *${(inc * 13) / 100}*`,
    "5. Vale a ordem em que as mensagens aparecem no grupo. Em caso de empate, leva quem mandou primeiro.",
    `6. Lance no último minuto prorroga o lote por mais ${minutos(a.extensionMinutes)}. Prorroga quantas vezes for preciso, até passar ${minutos(a.extensionMinutes)} sem lance.`,
    "7. Eu aviso quando o lote abre, quando falta 1 minuto e quando encerra. O lote só fecha com a minha mensagem de *ENCERRADO*.",
    "8. Lance dado é compromisso e não pode ser cancelado. Mensagem apagada ou editada continua valendo pelo valor original.",
    "9. Lote sem lance não é vendido.",
    "",
    "*Pagamento e envio*",
    `10. Pagamento por Pix até *${deadlineLabel(a, lotCount)}* (${prazoHoras(a)} depois do fim do leilão). Chave: ${pixLabel(a)}`,
    `11. Envio: ${shippingLabel(a)}. Quem arrematar mais de um lote paga um frete só.`,
    "12. Quem não pagar no prazo perde o lote, que vai para o segundo maior lance, e fica fora dos próximos leilões.",
    "",
    "*Para o leilão andar bem*",
    "13. Durante as rodadas, só lances e dúvidas rápidas sobre o lote aberto. Conversa fica para o final.",
    "14. Quem arrematar recebe no privado a confirmação do lote, do valor e do Pix.",
    "",
    "Boa sorte a todos! 🍀",
  ].join("\n");
}

/** Lembrete do dia (sugestão: 13h30). */
export function middayText(a: Auction): string {
  return [
    `📣 *Hoje tem leilão na ${PLATFORM_NAME}!*`,
    "",
    `Logo mais, às *${hourLabel(a)}*, abrimos aqui no grupo o leilão da comunidade.`,
    "",
    "Separamos lotes especiais com 👑 Legends, 🃏 Adrenalyn XL, 🏆 figurinhas originais da Copa 2026, 📦 combos e ⭐ kits.",
    "",
    "As regras ficam fixadas no grupo antes de começar. Chama os amigos colecionadores e vem disputar! 🔨",
  ].join("\n");
}

export function reminderText(a: Auction): string {
  return [
    "⏰ *Falta 1 hora para o leilão!*",
    "",
    `Começa às ${hourLabel(a)}, aqui no grupo, com lotes selecionados para a sua coleção.`,
    "As regras estão fixadas no grupo. Separe o Pix e boa sorte! 🍀",
  ].join("\n");
}

/** Horário sugerido do lembrete de 1 hora antes. */
export function reminderTime(a: Auction): string {
  return hhmm(new Date(a.startsAt).getTime() - 3600000);
}

export function openingText(a: Auction, lotCount: number): string {
  return [
    `🔨 *COMEÇOU O LEILÃO ${BRAND}!*`,
    "",
    "Resumo das regras:",
    `• ${minutos(a.lotMinutes)} por lote`,
    `• Incremento mínimo de ${brl(a.minIncrementCents)} (pode dar mais), mande só o número`,
    `• Lance no último minuto prorroga +${minutos(a.extensionMinutes)}`,
    "• O lote fecha com a mensagem *ENCERRADO*",
    `• Pix até ${deadlineLabel(a, lotCount)}`,
    "",
    "O lote 1 abre em 1 minuto. Boa sorte! 🍀",
  ].join("\n");
}

// ---------- durante o leilão ----------

/** Legenda da foto quando o lote abre. n = número do lote (1…), end = horário de fechamento. */
export function openLotText(a: Auction, lot: AuctionLot, n: number, lotCount: number, end: Date): string {
  const begin = new Date(end.getTime() - a.lotMinutes * 60000);
  return [
    `🔨 *LEILÃO ${BRAND} · LOTE ${n}/${lotCount}*`,
    ...(n === lotCount && lotCount > 1 ? ["⭐ É o último lote da noite!"] : []),
    "",
    `⚽ *${lot.name}*`,
    ...(lot.detail ? [lot.detail] : []),
    "",
    `🟢 Abre: ${hhmm(begin)}`,
    `🔴 Fecha: ${hhmm(end)}`,
    "",
    `💵 Lance inicial: *${brl(lot.startCents)}*`,
    `➕ Incremento mínimo: ${brl(a.minIncrementCents)}`,
    "",
    "📌 *Lembre-se*",
    "› Lance editado ou apagado continua valendo.",
    "› Deu lance, comprou: não tem desistência.",
    `› Lance no último minuto prorroga o lote em +${minutos(a.extensionMinutes)}.`,
    "",
    "Bora, colecionadores! Leva quem der o maior lance 🏆",
  ].join("\n");
}

/** "Falta 1 minuto": só cita valor se o maior lance estiver preenchido no painel. */
export function oneMinuteText(lot: AuctionLot, n: number, bidCents: number | null): string {
  const line = bidCents ? `Maior lance até agora: *${brl(bidCents)}*. Quem dá mais?` : "Ainda dá tempo de mandar seu lance!";
  return `⏳ *Falta 1 minuto* para o lote ${n} (${lot.name}).\n${line}`;
}

/** Prorrogação sempre genérica: só acontece quando houve lance, e o valor já está no grupo. */
export function extendText(n: number, end: Date): string {
  return `⏱️ Lance no último minuto! *Lote ${n} prorrogado até ${hhmm(end)}*.\nAinda dá tempo de cobrir!`;
}

// Sem revelar o próximo lote: ele só aparece quando abre.
const nextLine = (n: number, lotCount: number) => (n >= lotCount ? "" : "\n\nO próximo lote abre em 1 minuto. 👀");

export function soldText(lot: AuctionLot, n: number, lotCount: number, who: string, cents: number): string {
  return `✅ *LOTE ${n} ENCERRADO*\n${lot.name} arrematado por *${who}* por *${brl(cents)}*. Parabéns! 🎉${nextLine(n, lotCount)}`;
}

export function noBidText(n: number, lotCount: number): string {
  return `❌ *LOTE ${n} ENCERRADO SEM LANCE*\nO lote não foi vendido.${nextLine(n, lotCount)}`;
}

// ---------- depois do lote / do leilão ----------

function pixLines(a: Auction, lotCount: number, valor: string): string[] {
  const m = a.pixKey.match(/^(CPF\s*[\d.\-/]+)\s*\((.+)\)\s*$/);
  return [
    "💸 *Pagamento por Pix*",
    m ? `Chave: *${m[1]}*` : `Chave: *${pixLabel(a)}*`,
    ...(m ? [`Nome: ${m[2]}`] : []),
    `Valor: *${valor}* + frete`,
    `Prazo: até *${deadlineLabel(a, lotCount)}*`,
  ];
}

/** Confirmação de um lote, no privado, logo depois do arremate. */
export function confirmText(a: Auction, lot: AuctionLot, n: number, lotCount: number, who: string, cents: number): string {
  return [
    `Oi, ${who}! Parabéns, você arrematou no leilão da ${PLATFORM_NAME} 🎉`,
    "",
    `✅ *Lote ${n} · ${lot.name}*`,
    ...(lot.detail ? [lot.detail] : []),
    `Lance vencedor: *${brl(cents)}*`,
    "",
    ...pixLines(a, lotCount, brl(cents)),
    "",
    "Assim que pagar, me mande o comprovante e o seu CEP para eu calcular o frete.",
    "Se arrematar mais lotes, pode pagar tudo junto no final: eu mando o total com um frete só.",
  ].join("\n");
}

/** Mensagem de encerramento no grupo, com o resultado de cada lote encerrado. */
export function finalText(a: Auction, lots: AuctionLot[], bidders: Record<string, Bidder>): string {
  const lines = [`🏁 *FIM DO LEILÃO ${BRAND}*`, "", "Obrigado a todos que participaram! Resultado:", ""];
  let any = false;
  lots.forEach((l, i) => {
    if (l.status === "arrematado" && l.soldCents !== null) {
      any = true;
      lines.push(`*${i + 1}.* ${l.name}: ${bidders[l.bidderId ?? ""]?.name || "arrematado"} · ${brl(l.soldCents)}`);
    } else if (l.status === "sem_lance") {
      any = true;
      lines.push(`*${i + 1}.* ${l.name}: sem lance`);
    }
  });
  if (!any) lines.push("_(encerre os lotes no painel para montar a lista)_");
  lines.push("", `Quem arrematou já recebeu ou vai receber a confirmação no privado. O prazo do Pix é até ${deadlineLabel(a, lots.length)}.`);
  return lines.join("\n");
}

export interface Charge {
  bidderId: string;
  name: string;
  whatsapp: string;
  count: number;
  totalCents: number;
  text: string;
}

/** Cobrança no privado: um resumo por arrematante, com todos os lotes dele e o total. */
export function chargeTexts(a: Auction, lots: AuctionLot[], bidders: Record<string, Bidder>): Charge[] {
  const by = new Map<string, { lot: AuctionLot; n: number }[]>();
  lots.forEach((l, i) => {
    if (l.status !== "arrematado" || !l.bidderId) return;
    by.set(l.bidderId, [...(by.get(l.bidderId) ?? []), { lot: l, n: i + 1 }]);
  });
  return [...by.entries()].map(([bidderId, items]) => {
    const b = bidders[bidderId] ?? { name: "", whatsapp: "" };
    const total = items.reduce((s, i) => s + (i.lot.soldCents ?? 0), 0);
    const text = [
      `Oi, ${b.name || "tudo bem"}! Obrigado por participar do leilão da ${PLATFORM_NAME} 🎉`,
      "",
      `Seu resumo (${plural(items.length, "lote", "lotes")}):`,
      ...items.map((i) => `✅ Lote ${i.n} · ${i.lot.name}: ${brl(i.lot.soldCents ?? 0)}`),
      "",
      ...pixLines(a, lots.length, brl(total)),
      "",
      "Me mande o comprovante e o seu CEP para eu calcular o frete (um frete só para todos os lotes). Se já pagou algum lote, desconte do total.",
    ].join("\n");
    return { bidderId, name: b.name, whatsapp: b.whatsapp, count: items.length, totalCents: total, text };
  });
}

/** Aviso de envio no privado, com o código e o link de rastreio. */
export function trackingText(name: string, trackingCode: string, trackingUrl: string): string {
  return [
    `Oi, ${name || "tudo bem"}! Seu pacote do leilão da ${PLATFORM_NAME} já foi enviado 📦`,
    "",
    ...(trackingCode ? [`Código de rastreio: *${trackingCode}*`] : []),
    ...(trackingUrl ? [`Acompanhe aqui: ${trackingUrl}`] : []),
    "",
    "Qualquer dúvida, é só me chamar. Obrigado por participar! 🙌",
  ].join("\n");
}
