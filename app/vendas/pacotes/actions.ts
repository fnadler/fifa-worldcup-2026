"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { startsAtFromInputs } from "@/lib/auctions";
import { slugify } from "@/lib/brand";
import {
  LEGEND_CODES,
  LOT_DESCRIPTION_MAX,
  LOT_IMAGE_BUCKET,
  LOT_IMAGE_MAX_BYTES,
  LOT_MAX_PACKS,
  LOT_SLUG_MAX,
  LOT_TITLE_MAX,
  type LotStatus,
} from "@/lib/packs";
import { packSeller } from "@/lib/packsServer";
import { parseBRL } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";

// Ações do painel de lotes. Cada uma é um ponto de entrada público (POST): confere o lojista antes de
// tudo e valida cada campo. As funções do banco recebem o id do lojista da sessão, nunca do cliente.

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const DENIED = { ok: false as const, error: "Acesso negado." };
const STATUSES: LotStatus[] = ["rascunho", "ativo", "pausado"];

const clean = (s: unknown) => (typeof s === "string" ? s.trim().replace(/[ \t]+/g, " ") : "");
const multiline = (s: unknown) => (typeof s === "string" ? s.replace(/\r\n/g, "\n").trim() : "");

function refresh(lotId?: string) {
  revalidatePath("/vendas/pacotes");
  if (lotId) revalidatePath(`/vendas/pacotes/${lotId}`);
}

/** Erro do banco → texto para o lojista (as funções levantam mensagens prontas em português). */
function dbError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.startsWith("INDISPONIVEL:")) return "Não há repetidas livres suficientes dessa Legend.";
  return /^[A-ZÀ-Ú]/.test(message) ? message : fallback;
}

// ---------- lote ----------

// FormData: title, slug, description, price, useShopMin ("1"), minOrder, date, time,
// image (arquivo, opcional), removeImage ("1").
export async function saveLot(id: string | null, form: FormData): Promise<Result<{ id: string }>> {
  const s = await packSeller();
  if (!s) return DENIED;
  if (id !== null && !UUID.test(id)) return { ok: false, error: "Lote não encontrado." };
  const sellerId = s.user.id;

  const title = clean(form.get("title"));
  if (title.length < 2 || title.length > LOT_TITLE_MAX) return { ok: false, error: `Dê um nome ao lote (até ${LOT_TITLE_MAX} caracteres).` };
  const slug = clean(form.get("slug")).toLowerCase() || slugify(title);
  if (!SLUG.test(slug) || slug.length < 2 || slug.length > LOT_SLUG_MAX)
    return { ok: false, error: "Endereço inválido: use letras minúsculas, números e hífen (ex: lote-1)." };
  const description = multiline(form.get("description"));
  if (description.length > LOT_DESCRIPTION_MAX) return { ok: false, error: "Descrição muito longa." };

  const price = parseBRL(clean(form.get("price")));
  if (price === null || Number.isNaN(price) || price < 100 || price > 10000000)
    return { ok: false, error: "Preço do pacote inválido. Use o formato 24,90." };

  let minOrder: number | null = null;
  if (form.get("useShopMin") !== "1") {
    const m = parseBRL(clean(form.get("minOrder")));
    if (m === null || Number.isNaN(m) || m < 0 || m > 10000000) return { ok: false, error: "Pedido mínimo inválido. Use o formato 30,00 (ou 0 para nenhum)." };
    minOrder = m;
  }

  const date = clean(form.get("date"));
  const time = clean(form.get("time")) || "00:00";
  let startsAt: string | null = null;
  if (date) {
    startsAt = startsAtFromInputs(date, time);
    if (!startsAt) return { ok: false, error: "Data de início inválida." };
  }

  const image = form.get("image");
  const file = image instanceof File && image.size > 0 ? image : null;
  if (file && !IMAGE_TYPES[file.type]) return { ok: false, error: "Use uma imagem JPG, PNG ou WebP." };
  if (file && file.size > LOT_IMAGE_MAX_BYTES) return { ok: false, error: "Imagem grande demais (máx. 3 MB)." };
  const removeImage = form.get("removeImage") === "1";

  const admin = createAdminClient();
  let previousImage: string | null = null;
  const lotId = id ?? randomUUID();
  if (id) {
    const { data: cur } = await admin.from("pack_lots").select("image_url").eq("id", id).eq("seller_id", sellerId).maybeSingle();
    if (!cur) return { ok: false, error: "Lote não encontrado." };
    previousImage = cur.image_url;
  }

  let imageUrl: string | null | undefined; // undefined = não mexe
  if (file) {
    const path = `${sellerId}/${lotId}/${randomUUID()}.${IMAGE_TYPES[file.type]}`;
    const { error: upErr } = await admin.storage.from(LOT_IMAGE_BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) return { ok: false, error: "Não foi possível enviar a imagem — tente de novo." };
    imageUrl = admin.storage.from(LOT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  } else if (removeImage) {
    imageUrl = null;
  }

  const values = {
    title,
    slug,
    description,
    price_cents: price,
    min_order_cents: minOrder,
    starts_at: startsAt,
    ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
    updated_at: new Date().toISOString(),
  };
  const { error } = id
    ? await admin.from("pack_lots").update(values).eq("id", id).eq("seller_id", sellerId)
    : await admin.from("pack_lots").insert({ id: lotId, seller_id: sellerId, ...values });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Você já tem um lote com esse endereço. Escolha outro." };
    return { ok: false, error: "Não foi possível salvar o lote — tente de novo." };
  }

  // imagem antiga sai do bucket quando foi trocada ou removida
  if (imageUrl !== undefined && previousImage) {
    const marker = `/object/public/${LOT_IMAGE_BUCKET}/`;
    const old = previousImage.split(marker)[1];
    if (old) await admin.storage.from(LOT_IMAGE_BUCKET).remove([decodeURIComponent(old)]);
  }
  refresh(lotId);
  return { ok: true, id: lotId };
}

export async function deleteLot(id: string): Promise<Result> {
  const s = await packSeller();
  if (!s) return DENIED;
  if (!UUID.test(id)) return { ok: false, error: "Lote não encontrado." };
  const admin = createAdminClient();
  const { error } = await admin.rpc("pack_lot_delete", { p_seller: s.user.id, p_lot: id });
  if (error) return { ok: false, error: dbError(error.message, "Não foi possível excluir o lote — tente de novo.") };
  const folder = `${s.user.id}/${id}`;
  const { data: files } = await admin.storage.from(LOT_IMAGE_BUCKET).list(folder, { limit: 100 });
  if (files?.length) await admin.storage.from(LOT_IMAGE_BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
  refresh();
  return { ok: true };
}

export async function setLotStatus(id: string, status: string): Promise<Result> {
  const s = await packSeller();
  if (!s) return DENIED;
  if (!UUID.test(id)) return { ok: false, error: "Lote não encontrado." };
  const next = STATUSES.find((x) => x === status);
  if (!next) return { ok: false, error: "Situação inválida." };
  const { error } = await createAdminClient().rpc("pack_lot_set_status", { p_seller: s.user.id, p_lot: id, p_status: next });
  if (error) return { ok: false, error: dbError(error.message, "Não foi possível mudar a situação — tente de novo.") };
  refresh(id);
  return { ok: true };
}

// ---------- pote ----------

/** codes: uma entrada por unidade. */
export async function addLegends(lotId: string, codes: string[]): Promise<Result> {
  const s = await packSeller();
  if (!s) return DENIED;
  if (!UUID.test(lotId)) return { ok: false, error: "Lote não encontrado." };
  if (!Array.isArray(codes) || codes.length === 0) return { ok: true };
  if (codes.length > LOT_MAX_PACKS || codes.some((c) => typeof c !== "string" || !LEGEND_CODES.has(c)))
    return { ok: false, error: "Legend inválida." };
  const { error } = await createAdminClient().rpc("pack_lot_add_legends", { p_seller: s.user.id, p_lot: lotId, p_codes: codes });
  if (error) return { ok: false, error: dbError(error.message, "Não foi possível colocar as Legends no pote — tente de novo.") };
  refresh(lotId);
  return { ok: true };
}

export async function removeLegends(lotId: string, code: string, qty: number): Promise<Result> {
  const s = await packSeller();
  if (!s) return DENIED;
  if (!UUID.test(lotId)) return { ok: false, error: "Lote não encontrado." };
  if (typeof code !== "string" || !LEGEND_CODES.has(code) || !Number.isInteger(qty) || qty < 1 || qty > LOT_MAX_PACKS)
    return { ok: false, error: "Legend inválida." };
  const { error } = await createAdminClient().rpc("pack_lot_remove_legends", { p_seller: s.user.id, p_lot: lotId, p_code: code, p_qty: qty });
  if (error) return { ok: false, error: dbError(error.message, "Não foi possível tirar as Legends do pote — tente de novo.") };
  refresh(lotId);
  return { ok: true };
}
