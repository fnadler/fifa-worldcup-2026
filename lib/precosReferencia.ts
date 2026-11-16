import "server-only";
import type { PrecosReferencia } from "./repetidasLoja";
import { createAdminClient } from "./supabase/admin";

// Preço de referência por coleção: a mediana, por grupo, do que as lojas da plataforma cobram (shop_albums).
// Só para estimar o valor das repetidas de quem ainda não tem loja. Guardado por 1 hora na memória do servidor.

const VALIDADE_MS = 60 * 60 * 1000;
let cache: { em: number; precos: PrecosReferencia } | null = null;

const mediana = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export async function precosReferencia(): Promise<PrecosReferencia> {
  if (cache && Date.now() - cache.em < VALIDADE_MS) return cache.precos;
  const { data, error } = await createAdminClient().from("shop_albums").select("album_id, group_prices");
  if (error) {
    console.error("[preços de referência]", error.message);
    return cache?.precos ?? {};
  }
  const valores: Record<string, Record<string, number[]>> = {};
  for (const r of data ?? []) {
    for (const [grupo, cents] of Object.entries((r.group_prices ?? {}) as Record<string, unknown>)) {
      if (typeof cents === "number" && cents > 0) ((valores[r.album_id] ??= {})[grupo] ??= []).push(cents);
    }
  }
  const precos: PrecosReferencia = {};
  for (const [album, grupos] of Object.entries(valores)) {
    precos[album] = Object.fromEntries(Object.entries(grupos).map(([g, v]) => [g, mediana(v)]));
  }
  cache = { em: Date.now(), precos };
  return precos;
}
