// Rotas principais. A "/" é a landing pública; a área do colecionador fica em /colecao.
export const COLLECTION_PATH = "/colecao";
export const SIGNUP_PATH = "/login?modo=cadastro";
/** Tela "e-mail confirmado", aberta pelo link de confirmação do cadastro. */
export const SIGNUP_CONFIRMED_PATH = "/login/confirmado";

/**
 * Aceita só caminhos internos em ?next= (evita redirecionar para sites externos). Além de "//" e "/\\",
 * recusa barra invertida e caracteres de controle em qualquer posição: o navegador descarta tab e quebra
 * de linha ao montar o endereço, então "/<tab>/site.com" viraria "//site.com".
 */
export function safeNext(next: string | null | undefined, fallback = COLLECTION_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}

/** Link de cadastro que, depois de criar a conta, segue para `next`. */
export function signupThen(next: string): string {
  return `${SIGNUP_PATH}&next=${encodeURIComponent(next)}`;
}
