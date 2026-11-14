"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  AUCTION_ANNOUNCEMENT_MAX,
  AUCTION_IMAGE_BUCKET,
  AUCTION_PIX_MAX,
  AUCTION_SHIPPING_MAX,
  AUCTION_TITLE_MAX,
  LOT_DETAIL_MAX,
  LOT_IMAGE_MAX_BYTES,
  LOT_NAME_MAX,
  startsAtFromInputs,
  suggestedStartCents,
  type AuctionStatus,
} from "@/lib/auctions";
import { adminUser } from "@/lib/auctionsServer";
import { isValidPhoneBR, normalizeWhatsapp } from "@/lib/phone";
import { parseBRL } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";

// Ações do controle de leilões. Cada uma é um ponto de entrada público (POST): confere o admin
// antes de tudo e valida cada campo — a tela não é barreira de segurança.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES: AuctionStatus[] = ["rascunho", "agendado", "ao_vivo", "encerrado"];
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const DENIED = { ok: false as const, error: "Acesso negado." };
const clean = (s: unknown) => (typeof s === "string" ? s.trim().replace(/[ \t]+/g, " ") : "");
const multiline = (s: unknown) => (typeof s === "string" ? s.replace(/\r\n/g, "\n").trim() : "");

function intIn(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** "" → null; inválido → NaN. */
function money(v: unknown): number | null {
  const s = typeof v === "string" ? v : "";
  return parseBRL(s);
}

function refresh(auctionId?: string) {
  revalidatePath("/admin/leiloes");
  if (auctionId) revalidatePath(`/admin/leiloes/${auctionId}`);
}

// ---------- leilão ----------

export interface AuctionInput {
  title: string;
  date: string;
  time: string;
  status: string;
  lotMinutes: string;
  extensionMinutes: string;
  minIncrement: string;
  pixKey: string;
  pixDeadlineHours: string;
  shippingNote: string;
  announcement: string;
}

export async function saveAuction(id: string | null, input: AuctionInput): Promise<Result<{ id: string }>> {
  if (!(await adminUser())) return DENIED;
  if (id !== null && !UUID.test(id)) return { ok: false, error: "Leilão não encontrado." };

  const title = clean(input.title);
  if (title.length < 2 || title.length > AUCTION_TITLE_MAX) return { ok: false, error: `Dê um nome ao leilão (até ${AUCTION_TITLE_MAX} caracteres).` };
  const startsAt = startsAtFromInputs(clean(input.date), clean(input.time));
  if (!startsAt) return { ok: false, error: "Informe a data e o horário do leilão." };
  const status = STATUSES.find((s) => s === input.status);
  if (!status) return { ok: false, error: "Situação inválida." };
  const lotMinutes = intIn(input.lotMinutes, 1, 30);
  if (lotMinutes === null) return { ok: false, error: "Tempo por lote: de 1 a 30 minutos." };
  const extensionMinutes = intIn(input.extensionMinutes, 1, 10);
  if (extensionMinutes === null) return { ok: false, error: "Prorrogação: de 1 a 10 minutos." };
  const increment = money(input.minIncrement);
  if (increment === null || Number.isNaN(increment) || increment < 100 || increment > 100000)
    return { ok: false, error: "Incremento mínimo: de R$ 1,00 a R$ 1.000,00." };
  const pixKey = clean(input.pixKey);
  if (pixKey.length > AUCTION_PIX_MAX) return { ok: false, error: "Chave Pix muito longa." };
  const pixDeadlineHours = intIn(input.pixDeadlineHours, 1, 168);
  if (pixDeadlineHours === null) return { ok: false, error: "Prazo do Pix: de 1 a 168 horas." };
  const shippingNote = clean(input.shippingNote);
  if (shippingNote.length > AUCTION_SHIPPING_MAX) return { ok: false, error: "Texto do frete muito longo." };
  const announcement = multiline(input.announcement);
  if (announcement.length > AUCTION_ANNOUNCEMENT_MAX) return { ok: false, error: "Texto de divulgação muito longo." };

  const values = {
    title,
    starts_at: startsAt,
    status,
    lot_minutes: lotMinutes,
    extension_minutes: extensionMinutes,
    min_increment_cents: increment,
    pix_key: pixKey,
    pix_deadline_hours: pixDeadlineHours,
    shipping_note: shippingNote,
    announcement,
    updated_at: new Date().toISOString(),
  };
  const admin = createAdminClient();
  const query = id ? admin.from("auctions").update(values).eq("id", id) : admin.from("auctions").insert(values);
  const { data, error } = await query.select("id").single<{ id: string }>();
  if (error || !data) return { ok: false, error: "Não foi possível salvar o leilão — tente de novo." };
  refresh(data.id);
  return { ok: true, id: data.id };
}

export async function deleteAuction(id: string): Promise<Result> {
  if (!(await adminUser())) return DENIED;
  if (!UUID.test(id)) return { ok: false, error: "Leilão não encontrado." };
  const admin = createAdminClient();
  const { count } = await admin.from("auction_lots").select("id", { count: "exact", head: true }).eq("auction_id", id).eq("status", "arrematado");
  if (count) return { ok: false, error: "Este leilão tem lotes arrematados e não pode ser excluído." };

  const { data: files } = await admin.storage.from(AUCTION_IMAGE_BUCKET).list(id, { limit: 1000 });
  const { error } = await admin.from("auctions").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível excluir o leilão — tente de novo." };
  if (files?.length) await admin.storage.from(AUCTION_IMAGE_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
  refresh();
  return { ok: true };
}

// ---------- lotes ----------

// FormData: auctionId, lotId (vazio = novo), name, detail, estimateMin, estimateMax, start,
// image (arquivo, opcional), removeImage ("1" para tirar a foto).
export async function saveLot(form: FormData): Promise<Result> {
  if (!(await adminUser())) return DENIED;
  const auctionId = clean(form.get("auctionId"));
  const lotId = clean(form.get("lotId")) || null;
  if (!UUID.test(auctionId) || (lotId !== null && !UUID.test(lotId))) return { ok: false, error: "Lote não encontrado." };

  const name = clean(form.get("name"));
  if (name.length < 2 || name.length > LOT_NAME_MAX) return { ok: false, error: `Dê um nome ao lote (até ${LOT_NAME_MAX} caracteres).` };
  const detail = clean(form.get("detail"));
  if (detail.length > LOT_DETAIL_MAX) return { ok: false, error: "Descrição muito longa." };
  const estMin = money(form.get("estimateMin"));
  const estMax = money(form.get("estimateMax"));
  if (Number.isNaN(estMin) || Number.isNaN(estMax)) return { ok: false, error: "Estimativa inválida. Use o formato 60 ou 60,00." };
  if (estMin !== null && estMax !== null && estMin > estMax) return { ok: false, error: "A estimativa mínima é maior que a máxima." };
  let start = money(form.get("start"));
  if (Number.isNaN(start)) return { ok: false, error: "Lance inicial inválido. Use o formato 80 ou 80,00." };
  if (start === null) start = suggestedStartCents(estMin, estMax);
  if (start === null) return { ok: false, error: "Informe o lance inicial (ou a estimativa, para usar o ponto médio)." };
  if (start > 10000000 || (estMin ?? 0) > 10000000 || (estMax ?? 0) > 10000000) return { ok: false, error: "Valor alto demais." };

  const image = form.get("image");
  const file = image instanceof File && image.size > 0 ? image : null;
  if (file && !IMAGE_TYPES[file.type]) return { ok: false, error: "Use uma foto JPG, PNG ou WebP." };
  if (file && file.size > LOT_IMAGE_MAX_BYTES) return { ok: false, error: "Foto grande demais (máx. 3 MB)." };
  const removeImage = form.get("removeImage") === "1";

  const admin = createAdminClient();
  const { data: auction } = await admin.from("auctions").select("id").eq("id", auctionId).maybeSingle();
  if (!auction) return { ok: false, error: "Leilão não encontrado." };

  let previous: string | null = null;
  let position = 0;
  if (lotId) {
    const { data: lot } = await admin.from("auction_lots").select("image_path").eq("id", lotId).eq("auction_id", auctionId).maybeSingle();
    if (!lot) return { ok: false, error: "Lote não encontrado." };
    previous = lot.image_path;
  } else {
    const { data: last } = await admin
      .from("auction_lots")
      .select("position")
      .eq("auction_id", auctionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = last ? last.position + 1 : 0;
  }

  let imagePath: string | null | undefined; // undefined = não mexe
  if (file) {
    imagePath = `${auctionId}/${randomUUID()}.${IMAGE_TYPES[file.type]}`;
    const { error: upErr } = await admin.storage.from(AUCTION_IMAGE_BUCKET).upload(imagePath, file, { contentType: file.type });
    if (upErr) return { ok: false, error: "Não foi possível enviar a foto — tente de novo." };
  } else if (removeImage) {
    imagePath = null;
  }

  const values = {
    name,
    detail,
    estimate_min_cents: estMin,
    estimate_max_cents: estMax,
    start_cents: start,
    ...(imagePath !== undefined ? { image_path: imagePath } : {}),
    updated_at: new Date().toISOString(),
  };
  const { error } = lotId
    ? await admin.from("auction_lots").update(values).eq("id", lotId).eq("auction_id", auctionId)
    : await admin.from("auction_lots").insert({ ...values, auction_id: auctionId, position });
  if (error) {
    if (file && imagePath) await admin.storage.from(AUCTION_IMAGE_BUCKET).remove([imagePath]); // não deixa foto órfã
    return { ok: false, error: "Não foi possível salvar o lote — tente de novo." };
  }
  if (imagePath !== undefined && previous && previous !== imagePath) await admin.storage.from(AUCTION_IMAGE_BUCKET).remove([previous]);
  refresh(auctionId);
  return { ok: true };
}

async function renumber(auctionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("auction_lots").select("id, position").eq("auction_id", auctionId).order("position").order("created_at");
  await Promise.all(
    (data ?? []).flatMap((l, i) => (l.position === i ? [] : [admin.from("auction_lots").update({ position: i }).eq("id", l.id)]))
  );
}

export async function deleteLot(auctionId: string, lotId: string): Promise<Result> {
  if (!(await adminUser())) return DENIED;
  if (!UUID.test(auctionId) || !UUID.test(lotId)) return { ok: false, error: "Lote não encontrado." };
  const admin = createAdminClient();
  const { data: lot } = await admin.from("auction_lots").select("status, image_path").eq("id", lotId).eq("auction_id", auctionId).maybeSingle();
  if (!lot) return { ok: false, error: "Lote não encontrado." };
  if (lot.status === "arrematado") return { ok: false, error: "Este lote já foi arrematado e não pode ser excluído." };
  const { error } = await admin.from("auction_lots").delete().eq("id", lotId);
  if (error) return { ok: false, error: "Não foi possível excluir o lote — tente de novo." };
  if (lot.image_path) await admin.storage.from(AUCTION_IMAGE_BUCKET).remove([lot.image_path]);
  await renumber(auctionId);
  refresh(auctionId);
  return { ok: true };
}

/** Troca o lote de lugar com o vizinho (delta -1 = sobe, +1 = desce). */
export async function moveLot(auctionId: string, lotId: string, delta: -1 | 1): Promise<Result> {
  if (!(await adminUser())) return DENIED;
  if (!UUID.test(auctionId) || !UUID.test(lotId) || (delta !== -1 && delta !== 1)) return { ok: false, error: "Lote não encontrado." };
  await renumber(auctionId);
  const admin = createAdminClient();
  const { data } = await admin.from("auction_lots").select("id, position").eq("auction_id", auctionId).order("position");
  const lots = data ?? [];
  const i = lots.findIndex((l) => l.id === lotId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lots.length) return { ok: true };
  await Promise.all([
    admin.from("auction_lots").update({ position: j }).eq("id", lots[i].id),
    admin.from("auction_lots").update({ position: i }).eq("id", lots[j].id),
  ]);
  refresh(auctionId);
  return { ok: true };
}

// ---------- painel ao vivo ----------
// O cronômetro mora no banco (closes_at): recarregar a página ou trocar de aparelho não perde o tempo.

function refreshLive(auctionId: string) {
  refresh(auctionId);
  revalidatePath(`/admin/leiloes/${auctionId}/ao-vivo`);
}

async function liveLot(auctionId: string, lotId: string) {
  if (!UUID.test(auctionId) || !UUID.test(lotId)) return null;
  const admin = createAdminClient();
  const [{ data: auction }, { data: lot }] = await Promise.all([
    admin.from("auctions").select("id, status, lot_minutes, extension_minutes").eq("id", auctionId).maybeSingle(),
    admin.from("auction_lots").select("id, status, closes_at, bidder_id").eq("id", lotId).eq("auction_id", auctionId).maybeSingle(),
  ]);
  return auction && lot ? { admin, auction, lot } : null;
}

/** Muda o lote em foco no painel (sem abrir). */
export async function selectLot(auctionId: string, lotId: string): Promise<Result> {
  if (!(await adminUser())) return DENIED;
  const ctx = await liveLot(auctionId, lotId);
  if (!ctx) return { ok: false, error: "Lote não encontrado." };
  await ctx.admin.from("auctions").update({ current_lot_id: lotId }).eq("id", auctionId);
  refreshLive(auctionId);
  return { ok: true };
}

/** Abre o lote (ou reinicia o cronômetro de um lote aberto): fecha em agora + minutos por lote. */
export async function openLot(auctionId: string, lotId: string): Promise<Result<{ closesAt: string }>> {
  if (!(await adminUser())) return DENIED;
  const ctx = await liveLot(auctionId, lotId);
  if (!ctx) return { ok: false, error: "Lote não encontrado." };
  if (ctx.lot.status === "arrematado" || ctx.lot.status === "sem_lance")
    return { ok: false, error: "Este lote já foi encerrado. Use “Corrigir resultado” para reabrir." };
  if (ctx.auction.status === "encerrado") return { ok: false, error: "O leilão está encerrado." };
  const now = new Date();
  const closesAt = new Date(now.getTime() + ctx.auction.lot_minutes * 60000).toISOString();
  const { error } = await ctx.admin
    .from("auction_lots")
    .update({ status: "aberto", opened_at: now.toISOString(), closes_at: closesAt, updated_at: now.toISOString() })
    .eq("id", lotId);
  if (error) return { ok: false, error: "Não foi possível abrir o lote — tente de novo." };
  await ctx.admin.from("auctions").update({ current_lot_id: lotId, status: "ao_vivo" }).eq("id", auctionId);
  refreshLive(auctionId);
  return { ok: true, closesAt };
}

/** Prorroga: soma os minutos de prorrogação ao fechamento (ou a agora, se o tempo já acabou). */
export async function extendLot(auctionId: string, lotId: string): Promise<Result<{ closesAt: string }>> {
  if (!(await adminUser())) return DENIED;
  const ctx = await liveLot(auctionId, lotId);
  if (!ctx) return { ok: false, error: "Lote não encontrado." };
  if (ctx.lot.status !== "aberto") return { ok: false, error: "Abra o lote antes de prorrogar." };
  const base = Math.max(Date.now(), ctx.lot.closes_at ? new Date(ctx.lot.closes_at).getTime() : 0);
  const closesAt = new Date(base + ctx.auction.extension_minutes * 60000).toISOString();
  const { error } = await ctx.admin.from("auction_lots").update({ closes_at: closesAt, updated_at: new Date().toISOString() }).eq("id", lotId);
  if (error) return { ok: false, error: "Não foi possível prorrogar — tente de novo." };
  refreshLive(auctionId);
  return { ok: true, closesAt };
}

export interface SoldInput {
  cents: string;
  name: string;
  whatsapp: string;
}

/**
 * Encerra o lote. Com `sold`: grava valor e arrematante (criado ou atualizado pelo WhatsApp) e abre o
 * registro de pagamento/envio dele neste leilão. Sem `sold`: encerra sem lance.
 */
export async function closeLot(auctionId: string, lotId: string, sold: SoldInput | null): Promise<Result<{ bidderId: string | null }>> {
  if (!(await adminUser())) return DENIED;
  const ctx = await liveLot(auctionId, lotId);
  if (!ctx) return { ok: false, error: "Lote não encontrado." };
  if (ctx.lot.status === "arrematado" || ctx.lot.status === "sem_lance") return { ok: false, error: "Este lote já foi encerrado." };
  const { admin } = ctx;
  const now = new Date().toISOString();

  if (!sold) {
    const { error } = await admin
      .from("auction_lots")
      .update({ status: "sem_lance", sold_cents: null, bidder_id: null, closed_at: now, updated_at: now })
      .eq("id", lotId);
    if (error) return { ok: false, error: "Não foi possível encerrar o lote — tente de novo." };
    refreshLive(auctionId);
    return { ok: true, bidderId: null };
  }

  const { data: lotRow } = await admin.from("auction_lots").select("start_cents").eq("id", lotId).single();
  const cents = money(sold.cents);
  if (cents === null || Number.isNaN(cents) || cents > 10000000) return { ok: false, error: "Informe o maior lance." };
  if (lotRow && cents < lotRow.start_cents) return { ok: false, error: "O maior lance está abaixo do lance inicial." };
  const name = clean(sold.name);
  if (name.length < 1 || name.length > 80) return { ok: false, error: "Informe o nome de quem arrematou." };
  if (!isValidPhoneBR(sold.whatsapp)) return { ok: false, error: "Informe o WhatsApp de quem arrematou, com DDD." };
  const whatsapp = normalizeWhatsapp(sold.whatsapp);

  const { data: bidder, error: bErr } = await admin
    .from("auction_bidders")
    .upsert({ whatsapp, name, updated_at: now }, { onConflict: "whatsapp" })
    .select("id")
    .single<{ id: string }>();
  if (bErr || !bidder) return { ok: false, error: "Não foi possível gravar o arrematante — tente de novo." };

  const { error } = await admin
    .from("auction_lots")
    .update({ status: "arrematado", sold_cents: cents, bidder_id: bidder.id, closed_at: now, updated_at: now })
    .eq("id", lotId);
  if (error) return { ok: false, error: "Não foi possível encerrar o lote — tente de novo." };
  await admin.from("auction_settlements").upsert({ auction_id: auctionId, bidder_id: bidder.id }, { onConflict: "auction_id,bidder_id", ignoreDuplicates: true });
  refreshLive(auctionId);
  return { ok: true, bidderId: bidder.id };
}

/** Desfaz o resultado de um lote: volta para "aguardando". Tira o registro de pagamento se ficou vazio. */
export async function reopenLot(auctionId: string, lotId: string): Promise<Result> {
  if (!(await adminUser())) return DENIED;
  const ctx = await liveLot(auctionId, lotId);
  if (!ctx) return { ok: false, error: "Lote não encontrado." };
  const { admin } = ctx;
  const { error } = await admin
    .from("auction_lots")
    .update({ status: "aguardando", sold_cents: null, bidder_id: null, opened_at: null, closes_at: null, closed_at: null, updated_at: new Date().toISOString() })
    .eq("id", lotId);
  if (error) return { ok: false, error: "Não foi possível reabrir o lote — tente de novo." };
  if (ctx.lot.bidder_id) await dropEmptySettlement(auctionId, ctx.lot.bidder_id);
  refreshLive(auctionId);
  return { ok: true };
}

async function dropEmptySettlement(auctionId: string, bidderId: string) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("auction_lots")
    .select("id", { count: "exact", head: true })
    .eq("auction_id", auctionId)
    .eq("bidder_id", bidderId);
  if (!count) {
    await admin.from("auction_settlements").delete().eq("auction_id", auctionId).eq("bidder_id", bidderId).is("paid_at", null);
  }
}

/** Reinicia o leilão: todos os lotes voltam para "aguardando" e o painel volta ao lote 1. */
export async function resetAuction(auctionId: string): Promise<Result> {
  if (!(await adminUser())) return DENIED;
  if (!UUID.test(auctionId)) return { ok: false, error: "Leilão não encontrado." };
  const admin = createAdminClient();
  const { data: auction } = await admin.from("auctions").select("status").eq("id", auctionId).maybeSingle();
  if (!auction) return { ok: false, error: "Leilão não encontrado." };
  if (auction.status === "encerrado") return { ok: false, error: "O leilão está encerrado e não pode ser reiniciado." };
  const { count: paid } = await admin
    .from("auction_settlements")
    .select("bidder_id", { count: "exact", head: true })
    .eq("auction_id", auctionId)
    .not("paid_at", "is", null);
  if (paid) return { ok: false, error: "Já há pagamento registrado neste leilão. Corrija os lotes um a um." };
  const { error } = await admin
    .from("auction_lots")
    .update({ status: "aguardando", sold_cents: null, bidder_id: null, opened_at: null, closes_at: null, closed_at: null, updated_at: new Date().toISOString() })
    .eq("auction_id", auctionId);
  if (error) return { ok: false, error: "Não foi possível reiniciar — tente de novo." };
  await admin.from("auction_settlements").delete().eq("auction_id", auctionId);
  const { data: first } = await admin.from("auction_lots").select("id").eq("auction_id", auctionId).order("position").limit(1).maybeSingle();
  await admin.from("auctions").update({ current_lot_id: first?.id ?? null, status: "agendado" }).eq("id", auctionId);
  refreshLive(auctionId);
  return { ok: true };
}

/** Marca o leilão como encerrado (depois do último lote). */
export async function finishAuction(auctionId: string): Promise<Result> {
  if (!(await adminUser())) return DENIED;
  if (!UUID.test(auctionId)) return { ok: false, error: "Leilão não encontrado." };
  const admin = createAdminClient();
  const { count } = await admin.from("auction_lots").select("id", { count: "exact", head: true }).eq("auction_id", auctionId).eq("status", "aberto");
  if (count) return { ok: false, error: "Ainda há lote aberto. Encerre-o antes." };
  const { error } = await admin.from("auctions").update({ status: "encerrado", current_lot_id: null }).eq("id", auctionId);
  if (error) return { ok: false, error: "Não foi possível encerrar o leilão — tente de novo." };
  refreshLive(auctionId);
  return { ok: true };
}
