// Sinal barato de sessão aberta, sem baixar o cliente do Supabase (~65 KB): o @supabase/ssr guarda a
// sessão no cookie sb-<projeto>-auth-token (às vezes em partes .0, .1), legível no navegador. Sem ele não
// há ninguém logado — caso de quem chega pela landing vindo de um anúncio.
export function temCookieDeSessao(): boolean {
  return typeof document !== "undefined" && /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}
