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
