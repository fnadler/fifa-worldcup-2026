// Leilões da comunidade: tipos e utilitários compartilhados entre servidor e telas do /admin.
// Valores em centavos, como no resto da plataforma. Horários do leilão sempre no fuso de Brasília.

export type AuctionStatus = "rascunho" | "agendado" | "ao_vivo" | "encerrado";
export type LotStatus = "aguardando" | "aberto" | "arrematado" | "sem_lance";

export const AUCTION_STATUS_LABEL: Record<AuctionStatus, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  ao_vivo: "Ao vivo",
  encerrado: "Encerrado",
};

export const LOT_STATUS_LABEL: Record<LotStatus, string> = {
  aguardando: "Aguardando",
  aberto: "Aberto",
  arrematado: "Arrematado",
  sem_lance: "Sem lance",
};

export const AUCTION_TITLE_MAX = 80;
export const AUCTION_PIX_MAX = 120;
export const AUCTION_SHIPPING_MAX = 300;
export const AUCTION_ANNOUNCEMENT_MAX = 4000;
export const LOT_NAME_MAX = 80;
export const LOT_DETAIL_MAX = 300;
export const LOT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const AUCTION_IMAGE_BUCKET = "auction-lots";

export interface Auction {
  id: string;
  title: string;
  startsAt: string; // ISO
  status: AuctionStatus;
  lotMinutes: number;
  extensionMinutes: number;
  minIncrementCents: number;
  pixKey: string;
  pixDeadlineHours: number;
  shippingNote: string;
  announcement: string;
  currentLotId: string | null;
}

export interface AuctionLot {
  id: string;
  auctionId: string;
  position: number;
  name: string;
  detail: string;
  estimateMinCents: number | null;
  estimateMaxCents: number | null;
  startCents: number;
  imagePath: string | null;
  /** Link assinado e temporário da foto (o bucket é privado). */
  imageUrl: string | null;
  status: LotStatus;
  /** Fechamento do lote aberto (cronômetro do painel ao vivo). */
  closesAt: string | null;
  soldCents: number | null;
  bidderId: string | null;
}

export const AUCTION_COLUMNS =
  "id, title, starts_at, status, lot_minutes, extension_minutes, min_increment_cents, pix_key, pix_deadline_hours, shipping_note, announcement, current_lot_id";
export const LOT_COLUMNS =
  "id, auction_id, position, name, detail, estimate_min_cents, estimate_max_cents, start_cents, image_path, status, closes_at, sold_cents, bidder_id";

export interface AuctionRow {
  id: string;
  title: string;
  starts_at: string;
  status: AuctionStatus;
  lot_minutes: number;
  extension_minutes: number;
  min_increment_cents: number;
  pix_key: string;
  pix_deadline_hours: number;
  shipping_note: string;
  announcement: string;
  current_lot_id: string | null;
}

export interface LotRow {
  id: string;
  auction_id: string;
  position: number;
  name: string;
  detail: string;
  estimate_min_cents: number | null;
  estimate_max_cents: number | null;
  start_cents: number;
  image_path: string | null;
  status: LotStatus;
  closes_at: string | null;
  sold_cents: number | null;
  bidder_id: string | null;
}

export function auctionFromRow(r: AuctionRow): Auction {
  return {
    id: r.id,
    title: r.title,
    startsAt: r.starts_at,
    status: r.status,
    lotMinutes: r.lot_minutes,
    extensionMinutes: r.extension_minutes,
    minIncrementCents: r.min_increment_cents,
    pixKey: r.pix_key,
    pixDeadlineHours: r.pix_deadline_hours,
    shippingNote: r.shipping_note,
    announcement: r.announcement,
    currentLotId: r.current_lot_id,
  };
}

export function lotFromRow(r: LotRow, imageUrl: string | null = null): AuctionLot {
  return {
    id: r.id,
    auctionId: r.auction_id,
    position: r.position,
    name: r.name,
    detail: r.detail,
    estimateMinCents: r.estimate_min_cents,
    estimateMaxCents: r.estimate_max_cents,
    startCents: r.start_cents,
    imagePath: r.image_path,
    imageUrl,
    status: r.status,
    closesAt: r.closes_at,
    soldCents: r.sold_cents,
    bidderId: r.bidder_id,
  };
}

// Lance inicial sugerido: o ponto médio da estimativa, arredondado para cima em R$ 10.
export function suggestedStartCents(min: number | null, max: number | null): number | null {
  if (min === null && max === null) return null;
  const mid = ((min ?? max!) + (max ?? min!)) / 2;
  return Math.ceil(mid / 1000) * 1000;
}

// ---------- data e hora (Brasília, sem horário de verão desde 2019) ----------

const SP = "America/Sao_Paulo";

/** "2026-11-14" + "18:30" → ISO com o fuso de Brasília. */
export function startsAtFromInputs(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → { date: "2026-11-14", time: "18:30" } no fuso de Brasília. */
export function inputsFromStartsAt(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SP,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** "sáb., 14/11/2026 às 18:30" */
export function formatAuctionDate(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { timeZone: SP, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: SP, hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}
