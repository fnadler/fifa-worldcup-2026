// O Supabase devolve no máximo 1.000 linhas por consulta. Coleção (uma linha por item, somando
// todas as coleções da pessoa) e preços individuais passam disso — lê em páginas até acabar.
const PAGE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

/** `page(from, to)` monta a consulta com `.order(...)` estável e `.range(from, to)`. */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<PageResult<T>> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: null, error };
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: all, error: null };
  }
}
