import "server-only";

// ID anônimo do carrinho deste navegador (um por navegador, vale para qualquer loja).
export const CART_COOKIE = "copa_cart";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readCartId(value: string | undefined): string | null {
  return value && UUID.test(value) ? value : null;
}

export const CART_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
