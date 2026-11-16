import { priceFor } from "./shop";

// Quem tem muitas repetidas e ainda não tem loja: o convite no quadro (LojaBanner) e o e-mail (lib/repetidasEmail.ts).
// O valor estimado usa o preço de referência da plataforma: a mediana do preço por grupo das lojas que vendem a
// coleção (lib/precosReferencia.ts), pela mesma regra de preço da loja (priceFor).

/** A partir de quantas repetidas a pessoa recebe o convite para abrir a loja. */
export const LIMITE_REPETIDAS = 300;

/** albums.id → grupo de preço ("TEAM", "TEAM:ICON"…) → centavos. */
export type PrecosReferencia = Record<string, Record<string, number>>;

/** Valor das repetidas (o que passa de 1 unidade) pelo preço de referência, em centavos. 0 sem referência. */
export function valorRepetidas(qtd: Record<string, number>, precos: PrecosReferencia): number {
  const pricing = { groups: precos, individual: {} };
  let total = 0;
  for (const [code, n] of Object.entries(qtd)) {
    if (n > 1) total += (n - 1) * (priceFor(code, pricing) ?? 0);
  }
  return total;
}

/** "cerca de R$ 4.300": arredonda para não parecer preço exato (centena acima de R$ 1.000; dezena abaixo). */
export function valorAproximado(cents: number): string {
  const reais = cents / 100;
  const passo = reais >= 1000 ? 100 : 10;
  return `R$ ${(Math.round(reais / passo) * passo).toLocaleString("pt-BR")}`;
}
