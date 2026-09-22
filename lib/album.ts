import albumJson from "@/album.json";
import type { AlbumBlock, AlbumData, Anchor } from "./types";

export const ALBUM = albumJson as AlbumData;
export const BLOCKS: AlbumBlock[] = ALBUM.blocks;
export const TOTAL_STICKERS = ALBUM.total;

export const ANCHORAS: Anchor[] = BLOCKS.map((b) => ({
  id: b.id,
  label: b.tipo === "TEAM" ? `${b.grupo} · ${b.id}` : b.tipo === "FWC" ? "FWC" : "COCA-COLA",
  title: b.nome,
  variant: b.tipo === "TEAM" ? "team" : b.tipo === "FWC" ? "fwc" : "cc",
}));

export function anchorId(block: AlbumBlock): string {
  return `bl-${block.id}`;
}

export function blockTag(block: AlbumBlock): string {
  if (block.tipo === "TEAM") return `Grupo ${block.grupo}`;
  if (block.tipo === "FWC") return "FWC";
  return "Extra";
}

// Same output as the prototype's hardcoded strings ("00 · FWC1–19", "BRA1–20", "CC1–14"),
// derived generically from the block's own code list instead of a second hardcoded table.
export function codigoBase(block: AlbumBlock): string {
  if (block.tipo === "FWC") return "00 · FWC1–19";
  const first = block.codes[0];
  const last = block.codes[block.codes.length - 1];
  const prefix = first.match(/^[A-Za-z]+/)?.[0] ?? "";
  const firstNum = first.replace(/^[A-Za-z]+/, "");
  const lastNum = last.replace(/^[A-Za-z]+/, "");
  return `${prefix}${firstNum}–${lastNum}`;
}

export function stickerLabel(code: string): string {
  const num = code.replace(/^[A-Z]+/, "");
  return num || code;
}
