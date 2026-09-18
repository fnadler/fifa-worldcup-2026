import type { SupabaseClient } from "@supabase/supabase-js";
import type { Qtd } from "./types";

const PENDING_KEY = "copa2026-pending-writes-v1";
const DEBOUNCE_MS = 300;

function readPending(): Qtd {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Qtd) : {};
  } catch {
    return {};
  }
}

function writePending(map: Qtd): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors — the in-memory retry on next bump still applies
  }
}

export function getPendingSnapshot(): Qtd {
  return readPending();
}

function clearPendingCode(code: string): void {
  const map = readPending();
  delete map[code];
  writePending(map);
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

  constructor(supabase: SupabaseClient, userId: string, callbacks: SyncCallbacks) {
    this.supabase = supabase;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  hasPending(): boolean {
    return Object.keys(readPending()).length > 0;
  }

  schedule(code: string, qty: number): void {
    const map = readPending();
    map[code] = qty;
    writePending(map);

    const existing = this.timers.get(code);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.timers.delete(code);
      void this.deliver(code, qty);
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
      clearPendingCode(code);
      this.callbacks.onSynced(code, qty);
    } catch {
      clearPendingCode(code);
      this.callbacks.onError(code);
    }
  }

  async flushPending(): Promise<void> {
    const map = readPending();
    const entries = Object.entries(map);
    if (!entries.length) return;
    this.callbacks.onSaving();
    for (const [code, qty] of entries) {
      try {
        await sendOne(this.supabase, this.userId, code, qty);
        clearPendingCode(code);
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
  const { data, error } = await supabase
    .from("collection")
    .select("code, qty")
    .eq("user_id", userId);
  if (error) throw error;
  const qtd: Qtd = {};
  for (const row of data ?? []) {
    if (row.qty > 0) qtd[row.code as string] = row.qty as number;
  }
  return qtd;
}

export async function bulkUpsertQtd(
  supabase: SupabaseClient,
  userId: string,
  qtd: Qtd
): Promise<void> {
  const rows = Object.entries(qtd)
    .filter(([, qty]) => qty > 0)
    .map(([code, qty]) => ({
      user_id: userId,
      code,
      qty,
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) return;
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("collection").upsert(chunk, { onConflict: "user_id,code" });
    if (error) throw error;
  }
}
