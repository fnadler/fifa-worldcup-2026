import albumJson from "@/album.json";
import type { AlbumBlock, AlbumData, Anchor } from "./types";

export const ALBUM = albumJson as AlbumData;
export const BLOCKS: AlbumBlock[] = ALBUM.blocks;
// Total do álbum principal (994). As Legends são uma coleção à parte: aparecem no
// quadro e têm seus próprios contadores por bloco, mas não entram em Coladas/Faltam.
export const TOTAL_STICKERS = ALBUM.total;

export function countsTowardAlbum(block: AlbumBlock): boolean {
  return block.tipo !== "LEG";
}

function anchorLabel(b: AlbumBlock): string {
  if (b.tipo === "TEAM") return `${b.grupo} · ${b.id}`;
  if (b.tipo === "FWC") return "FWC";
  if (b.tipo === "CC") return "COCA-COLA";
  return b.nome.replace(/^Legends\s+/, "").toUpperCase();
}

export const ANCHORAS: Anchor[] = BLOCKS.map((b) => ({
  id: b.id,
  label: anchorLabel(b),
  title: b.nome,
  variant: b.tipo === "TEAM" ? "team" : b.tipo === "FWC" ? "fwc" : b.tipo === "CC" ? "cc" : "leg",
}));

const NAME_BY_CODE = new Map<string, string>();
BLOCKS.forEach((b) => b.labels?.forEach((nome, i) => NAME_BY_CODE.set(b.codes[i], nome)));

/** Nome próprio da figurinha, quando o catálogo tem (ex: atleta das Legends). */
export function stickerName(code: string): string | undefined {
  return NAME_BY_CODE.get(code);
}

export function anchorId(block: AlbumBlock): string {
  return `bl-${block.id}`;
}

export function blockTag(block: AlbumBlock): string {
  if (block.tipo === "TEAM") return `Grupo ${block.grupo}`;
  if (block.tipo === "FWC") return "FWC";
  if (block.tipo === "LEG") return "Legends";
  return "Extra";
}

// Same output as the prototype's hardcoded strings ("00 · FWC1–19", "BRA1–20", "CC1–14"),
// derived generically from the block's own code list instead of a second hardcoded table.
export function codigoBase(block: AlbumBlock): string {
  if (block.labels) return `${block.codes.length} atletas`;
  if (block.tipo === "FWC") return "00 · FWC1–19";
  const first = block.codes[0];
  const last = block.codes[block.codes.length - 1];
  const prefix = first.match(/^[A-Za-z]+/)?.[0] ?? "";
  const firstNum = first.replace(/^[A-Za-z]+/, "");
  const lastNum = last.replace(/^[A-Za-z]+/, "");
  return `${prefix}${firstNum}–${lastNum}`;
}

/** Blocos cujas figurinhas não são numeradas (Legends) mostram o nome — células mais largas. */
export function hasNamedStickers(block: AlbumBlock): boolean {
  return !!block.labels;
}

/** Texto dentro da célula: nome do atleta nas Legends, número nas demais. */
export function cellText(code: string): string {
  return stickerName(code) ?? stickerLabel(code);
}

export function stickerLabel(code: string): string {
  const num = code.replace(/^[A-Z]+/, "");
  return num || code;
}
