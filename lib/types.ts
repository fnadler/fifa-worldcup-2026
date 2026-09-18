export type Qtd = Record<string, number>;

export type BlockType = "FWC" | "TEAM" | "CC";

export interface AlbumBlock {
  id: string;
  nome: string;
  tipo: BlockType;
  grupo: string;
  codes: string[];
}

export interface AlbumData {
  total: number;
  blocks: AlbumBlock[];
}

export type TipoFiltro = "ALL" | "TEAM" | "FWC" | "CC";
export type StatusFiltro = "ALL" | "REP" | "MISS";
export type ModoClique = "add" | "sub";
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
  variant: "fwc" | "team" | "cc";
}
