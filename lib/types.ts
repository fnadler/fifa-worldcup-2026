export type Qtd = Record<string, number>;

/** Tipo do bloco — cada coleção define os seus (Álbum Copa: TEAM, FWC, CC, LEG; Adrenalyn: TEAM, SPECIAL, CONTENDER).
 *  É também o grupo de preço da loja. */
export type BlockType = string;

export interface AlbumBlock {
  id: string;
  nome: string;
  tipo: BlockType;
  grupo: string;
  codes: string[];
  /** Nome por figurinha, paralelo a `codes`, mostrado DENTRO da célula (Legends: nome do atleta). */
  labels?: string[];
  /** Nome por item, paralelo a `codes`, só para busca e descrição — a célula segue com o número (Adrenalyn). */
  names?: string[];
  /** Posição do jogador por item (GK, DEF, MID, FWD), paralelo a `codes`. */
  positions?: (string | null)[];
  /** Tipo do card por item (BASE, ICON, CREST…), paralelo a `codes`. */
  kinds?: string[];
}

export interface AlbumData {
  total: number;
  blocks: AlbumBlock[];
}

/** "ALL" ou um BlockType da coleção. */
export type TipoFiltro = "ALL" | BlockType;
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
