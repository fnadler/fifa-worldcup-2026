import type { Qtd } from "./types";

export const LOCAL_KEY = "copa2026-figurinhas-v1";

interface BackupShape {
  v: 1;
  atualizado: string;
  qtd: Qtd;
}

export function readLocalQtd(): Qtd {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.qtd) return parsed.qtd as Qtd;
    return {};
  } catch {
    return {};
  }
}

export function writeLocalQtd(qtd: Qtd): void {
  if (typeof window === "undefined") return;
  const payload: BackupShape = { v: 1, atualizado: new Date().toISOString(), qtd };
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(payload));
}

export function backupText(qtd: Qtd, pretty = false): string {
  const payload: BackupShape = { v: 1, atualizado: new Date().toISOString(), qtd };
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

export function parseBackupText(text: string): Qtd {
  const parsed = JSON.parse(text.trim());
  const qtd = parsed && typeof parsed === "object" && parsed.qtd ? parsed.qtd : parsed;
  if (!qtd || typeof qtd !== "object") throw new Error("invalid backup");
  return qtd as Qtd;
}
