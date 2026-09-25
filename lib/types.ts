export type Qtd = Record<string, number>;

export type BlockType = "FWC" | "TEAM" | "CC" | "LEG";

export interface AlbumBlock {
  id: string;
  nome: string;
  tipo: BlockType;
  grupo: string;
  codes: string[];
  /** Nome por figurinha, paralelo a `codes` (usado nas Legends: nome do atleta). */
  labels?: string[];
}

export interface AlbumData {
  total: number;
  blocks: AlbumBlock[];
}

export type TipoFiltro = "ALL" | "TEAM" | "FWC" | "CC" | "LEG";
export type StatusFiltro = "ALL" | "REP" | "MISS";
export type ModoClique = "add" | "sub";
export type ViewMode = "photos" | "grid";
export type SyncStatus = "idle" | "saving" | "synced" | "offline" | "error";

export interface AppUser {
  id: string;
  email: string | null;
}

export interface VisibleBlock {
  block: AlbumBlock;
  tag: string;
  codigoBase: string;
  coladas: number;
  repetidas: number;
  pct: number;
  stickers: { code: string; qty: number }[];
}

export interface Anchor {
  id: string;
  label: string;
  title: string;
  variant: "fwc" | "team" | "cc" | "leg";
}
