// Rotas principais. A "/" é a landing pública; a área do colecionador fica em /colecao.
export const COLLECTION_PATH = "/colecao";
export const SIGNUP_PATH = "/login?modo=cadastro";

/** Aceita só caminhos internos em ?next= (evita redirecionar para sites externos). */
export function safeNext(next: string | null | undefined, fallback = COLLECTION_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Link de cadastro que, depois de criar a conta, segue para `next`. */
export function signupThen(next: string): string {
  return `${SIGNUP_PATH}&next=${encodeURIComponent(next)}`;
}
