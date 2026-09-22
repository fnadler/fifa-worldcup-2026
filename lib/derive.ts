import { BLOCKS, TOTAL_STICKERS, blockTag, codigoBase } from "./album";
import type { Qtd, StatusFiltro, TipoFiltro, VisibleBlock } from "./types";

export interface DerivedBoard {
  totColadas: number;
  totRepetidas: number;
  totGeral: number;
  totFaltam: number;
  visibleBlocks: VisibleBlock[];
  listaTrocas: string;
}

export function deriveBoard(
  qtd: Qtd,
  tipo: TipoFiltro,
  statusFiltro: StatusFiltro,
  busca: string
): DerivedBoard {
  const buscaLower = busca.trim().toLowerCase();
  let totColadas = 0;
  let totRepetidas = 0;

  BLOCKS.forEach((b) => {
    b.codes.forEach((code) => {
      const n = qtd[code] ?? 0;
      if (n >= 1) totColadas++;
      if (n > 1) totRepetidas += n - 1;
    });
  });

  const visibleBlocks: VisibleBlock[] = [];
  BLOCKS.forEach((b) => {
    if (tipo !== "ALL" && tipo !== b.tipo) return;
    const matchBloco =
      !buscaLower ||
      b.nome.toLowerCase().includes(buscaLower) ||
      b.id.toLowerCase().includes(buscaLower);

    let coladas = 0;
    let repetidas = 0;
    const stickers: { code: string; qty: number }[] = [];

    b.codes.forEach((code) => {
      const n = qtd[code] ?? 0;
      if (n >= 1) coladas++;
      if (n > 1) repetidas += n - 1;

      if (statusFiltro === "REP" && n < 2) return;
      if (statusFiltro === "MISS" && n !== 0) return;
      if (buscaLower && !matchBloco && !code.toLowerCase().includes(buscaLower)) return;

      stickers.push({ code, qty: n });
    });

    if (!stickers.length) return;

    visibleBlocks.push({
      block: b,
      tag: blockTag(b),
      codigoBase: codigoBase(b),
      coladas,
      repetidas,
      pct: Math.round((coladas / b.codes.length) * 100),
      stickers,
    });
  });

  const linhas: string[] = [];
  BLOCKS.forEach((b) => {
    const itens = b.codes
      .filter((c) => (qtd[c] ?? 0) > 1)
      .map((c) => {
        const n = (qtd[c] ?? 0) - 1;
        return n > 1 ? `${c} (x${n})` : c;
      });
    if (itens.length) linhas.push(`${b.nome}: ${itens.join(", ")}`);
  });
  const listaTrocas = linhas.length
    ? `REPETIDAS — ÁLBUM COPA 2026\n\n${linhas.join("\n")}`
    : "Nenhuma repetida registrada ainda.";

  return {
    totColadas,
    totRepetidas,
    totGeral: TOTAL_STICKERS,
    totFaltam: TOTAL_STICKERS - totColadas,
    visibleBlocks,
    listaTrocas,
  };
}
