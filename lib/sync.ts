import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "./fetchAll";
import type { Qtd } from "./types";

// Marcações ainda não enviadas ao servidor — por conta, para nunca irem para a conta errada.
const PENDING_PREFIX = "copa2026-pending-writes-v1";
const DEBOUNCE_MS = 300;

function pendingKey(userId: string): string {
  return `${PENDING_PREFIX}:${userId}`;
}

function readPending(userId: string): Qtd {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(pendingKey(userId));
    return raw ? (JSON.parse(raw) as Qtd) : {};
  } catch {
    return {};
  }
}

function writePending(userId: string, map: Qtd): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pendingKey(userId), JSON.stringify(map));
  } catch {
    // ignore quota errors — the in-memory retry on next bump still applies
  }
}

export function getPendingSnapshot(userId: string): Qtd {
  return readPending(userId);
}

function clearPendingCode(userId: string, code: string): void {
  const map = readPending(userId);
  delete map[code];
  writePending(userId, map);
}

async function sendOne(
  supabase: SupabaseClient,
  userId: string,
  code: string,
  qty: number
): Promise<void> {
  if (qty <= 0) {
    const { error } = await supabase
      .from("collection")
      .delete()
      .eq("user_id", userId)
      .eq("code", code);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("collection")
      .upsert(
        { user_id: userId, code, qty, updated_at: new Date().toISOString() },
        { onConflict: "user_id,code" }
      );
    if (error) throw error;
  }
}

export interface SyncCallbacks {
  onSaving: () => void;
  onSynced: (code: string, qty: number) => void;
  onOffline: () => void;
  onError: (code: string) => void;
}

export class CollectionSync {
  private supabase: SupabaseClient;
  private userId: string;
  private callbacks: SyncCallbacks;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<Promise<void>>();

  constructor(supabase: SupabaseClient, userId: string, callbacks: SyncCallbacks) {
    this.supabase = supabase;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  hasPending(): boolean {
    return Object.keys(readPending(this.userId)).length > 0;
  }

  schedule(code: string, qty: number): void {
    const map = readPending(this.userId);
    map[code] = qty;
    writePending(this.userId, map);

    const existing = this.timers.get(code);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.timers.delete(code);
      const p = this.deliver(code, qty).finally(() => this.inFlight.delete(p));
      this.inFlight.add(p);
    }, DEBOUNCE_MS);
    this.timers.set(code, timer);
  }

  private async deliver(code: string, qty: number): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.callbacks.onOffline();
      return;
    }
    this.callbacks.onSaving();
    try {
      await sendOne(this.supabase, this.userId, code, qty);
      clearPendingCode(this.userId, code);
      this.callbacks.onSynced(code, qty);
    } catch {
      clearPendingCode(this.userId, code);
      this.callbacks.onError(code);
    }
  }

  /** Antes de uma marcação em lote: nada agendado pode chegar depois dela. Cancela as esperas, aguarda os
   *  envios em andamento e manda já o que estiver pendente. true = tudo foi entregue. */
  async settle(): Promise<boolean> {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    await Promise.allSettled([...this.inFlight]);
    await this.flushPending();
    return !this.hasPending();
  }

  async flushPending(): Promise<void> {
    const map = readPending(this.userId);
    const entries = Object.entries(map);
    if (!entries.length) return;
    this.callbacks.onSaving();
    for (const [code, qty] of entries) {
      try {
        await sendOne(this.supabase, this.userId, code, qty);
        clearPendingCode(this.userId, code);
        this.callbacks.onSynced(code, qty);
      } catch {
        // stays in the pending queue, retried on the next flush
      }
    }
    if (this.hasPending()) {
      this.callbacks.onOffline();
    }
  }
}

export async function fetchRemoteQtd(
  supabase: SupabaseClient,
  userId: string
): Promise<Qtd> {
  const { data, error } = await fetchAll<{ code: string; qty: number }>((from, to) =>
    supabase.from("collection").select("code, qty").eq("user_id", userId).gt("qty", 0).order("code").range(from, to)
  );
  if (error) throw error;
  const qtd: Qtd = {};
  for (const row of data ?? []) {
    if (row.qty > 0) qtd[row.code as string] = row.qty as number;
  }
  return qtd;
}

// ---------- marcação em lote (supabase_migration_bulk_marking.sql) ----------

export type BulkMode = "set" | "add";

/** O que o lote mudou, figurinha a figurinha (só as que mudaram). */
export interface BulkResult {
  codes: string[];
  old: number[];
  new: number[];
}

function asBulkResult(data: unknown): BulkResult {
  const r = data as Partial<BulkResult> | null;
  if (!r || !Array.isArray(r.codes) || !Array.isArray(r.old) || !Array.isArray(r.new)) throw new Error("resposta inválida");
  return { codes: r.codes, old: r.old, new: r.new };
}

/** "set": cada uma fica com qty (keepHigher não diminui quem tem mais); "add": soma qty. A conta é feita no banco. */
export async function bulkApply(
  supabase: SupabaseClient,
  albumId: string,
  codes: string[],
  mode: BulkMode,
  qty: number,
  keepHigher: boolean
): Promise<BulkResult> {
  const { data, error } = await supabase.rpc("collection_bulk_apply", {
    p_album_id: albumId,
    p_codes: codes,
    p_mode: mode,
    p_qty: qty,
    p_keep_higher: keepHigher,
  });
  if (error) throw error;
  return asBulkResult(data);
}

/** Desfazer: grava de volta os valores exatos de antes. */
export async function bulkRestore(supabase: SupabaseClient, albumId: string, codes: string[], qtys: number[]): Promise<BulkResult> {
  const { data, error } = await supabase.rpc("collection_bulk_restore", { p_album_id: albumId, p_codes: codes, p_qtys: qtys });
  if (error) throw error;
  return asBulkResult(data);
}
