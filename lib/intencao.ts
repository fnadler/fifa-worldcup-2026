// Intenção de quem chega para se cadastrar: vender as repetidas (abrir a loja) ou colecionar (grátis). Define a
// tela depois do cadastro: "de quais coleções você quer vender" + guia da loja, ou "o que você vai colecionar".
//
// De onde vem, nesta ordem: o botão clicado (?para= no link de cadastro), o link da loja (?next=/assinar), e o
// anúncio ou link que trouxe a pessoa (?para= na página de entrada, guardado no cookie gn_para pelo proxy).

export type Intencao = "vender" | "colecionar";

export const INTENT_COOKIE = "gn_para";
export const INTENT_MAX_AGE = 60 * 60 * 24 * 30;

export function lerIntencao(v: unknown): Intencao | null {
  return v === "vender" || v === "colecionar" ? v : null;
}

/** Intenção do cadastro: o botão (?para=) vale mais; depois o destino da loja; por último o anúncio (cookie). */
export function intencaoDoCadastro(para: unknown, next: string, cookie: unknown): Intencao {
  return lerIntencao(para) ?? (next.startsWith("/assinar") ? "vender" : null) ?? lerIntencao(cookie) ?? "colecionar";
}

/** Coleções da Copa 2026 (álbum, Adrenalyn XL e Gold Crumple): as primeiras na escolha; as outras ficam em "Ver mais". */
export const ehCopa2026 = (albumId: string) => albumId.startsWith("wc2026-");
