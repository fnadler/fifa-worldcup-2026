import { catalogOfBlock, lookupCode } from "./catalog";
import type { AlbumBlock } from "./types";

// Funções por código/bloco. Valem para qualquer coleção: o código é único na plataforma e cada
// bloco sabe a qual coleção pertence (ver lib/catalog.ts).

export function countsTowardAlbum(block: AlbumBlock): boolean {
  return catalogOfBlock(block).countsToward(block);
}

/** Nome próprio do item, quando o catálogo tem (atleta das Legends, jogador da Adrenalyn). */
export function stickerName(code: string): string | undefined {
  const e = lookupCode(code);
  return e ? (e.block.labels ?? e.block.names)?.[e.index] : undefined;
}

export function anchorId(block: AlbumBlock): string {
  return `bl-${block.id}`;
}

export function blockTag(block: AlbumBlock): string {
  return catalogOfBlock(block).blockTag(block);
}

export function codigoBase(block: AlbumBlock): string {
  return catalogOfBlock(block).blockRange(block);
}

/** Blocos cujas figurinhas não são numeradas (Legends) mostram o nome — células mais largas. */
export function hasNamedStickers(block: AlbumBlock): boolean {
  return !!block.labels;
}

/** A célula mostra o nome em vez do número (Legends). */
export function hasCellName(code: string): boolean {
  const e = lookupCode(code);
  return !!e?.block.labels;
}

/** Texto dentro da célula: nome do atleta nas Legends, número nas demais. */
export function cellText(code: string): string {
  const e = lookupCode(code);
  return e?.block.labels?.[e.index] ?? stickerLabel(code);
}

/** Código como as pessoas conhecem: "BRA9" no Álbum Copa, só o número na Adrenalyn ("24"). */
export function displayCode(code: string): string {
  const e = lookupCode(code);
  return e ? e.catalog.displayCode(code) : code;
}

/** Posição do jogador (GK, DEF, MID, FWD), quando o catálogo tem. */
export function itemPosition(code: string): string | null {
  const e = lookupCode(code);
  return e?.block.positions?.[e.index] ?? null;
}

export const POSITION_LABELS: Record<string, string> = {
  GK: "Goleiro",
  DEF: "Defensor",
  MID: "Meio-campo",
  FWD: "Atacante",
};

/** Tipo do card (BASE, ICON, CREST…), quando o catálogo tem. */
export function itemKind(code: string): string | null {
  const e = lookupCode(code);
  return e?.block.kinds?.[e.index] ?? null;
}

export function stickerLabel(code: string): string {
  const num = code.replace(/^[A-Z]+/, "");
  return num || code;
}
