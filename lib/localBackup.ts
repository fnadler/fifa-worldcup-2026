import type { Qtd } from "./types";

// Cópia local da coleção, SEPARADA POR CONTA (várias contas podem usar o mesmo navegador).
// A chave antiga, única para todas as contas, fez uma conta nova herdar a coleção de outra
// (ela era enviada ao servidor quando a coleção remota estava vazia) — por isso é descartada.
const LOCAL_PREFIX = "copa2026-figurinhas-v1";
const LEGACY_KEYS = ["copa2026-figurinhas-v1", "copa2026-pending-writes-v1"];

function localKey(userId: string): string {
  return `${LOCAL_PREFIX}:${userId}`;
}

/** Remove as chaves antigas compartilhadas (sem importar: não há como saber de quem eram). */
export function purgeLegacyLocalData(): void {
  if (typeof window === "undefined") return;
  try {
    LEGACY_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // armazenamento indisponível — nada a limpar
  }
}

interface BackupShape {
  v: 1;
  atualizado: string;
  qtd: Qtd;
}

export function readLocalQtd(userId: string): Qtd {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(localKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.qtd) return parsed.qtd as Qtd;
    return {};
  } catch {
    return {};
  }
}

export function writeLocalQtd(userId: string, qtd: Qtd): void {
  if (typeof window === "undefined") return;
  const payload: BackupShape = { v: 1, atualizado: new Date().toISOString(), qtd };
  try {
    window.localStorage.setItem(localKey(userId), JSON.stringify(payload));
  } catch {
    // sem espaço/armazenamento — o servidor continua sendo a fonte da verdade
  }
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
