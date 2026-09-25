// Identidade da plataforma e regras de nomes (coleção, loja) e do endereço da loja.
// Sem dependências — usado no cliente (prévia) e no servidor (validação).

export const PLATFORM_NAME = "GN Coleciona";

/** Máximo para nome da coleção e da loja: cabe no título (Bebas Neue) do topo no celular. */
export const NAME_MAX = 24;

export const DEFAULT_COLLECTION_NAME = "Minha coleção";
export const DEFAULT_SHOP_NAME = "Loja de figurinhas";

// Caminhos do próprio app — uma loja não pode "tomar" esses endereços.
export const RESERVED_SLUGS = new Set([
  "login", "perfil", "vendas", "loja", "lojas", "publico", "api", "auth", "assinar", "assinatura",
  "admin", "app", "conta", "config", "configuracoes", "ajuda", "suporte", "termos", "privacidade",
  "icon", "apple-icon", "manifest", "favicon", "brand", "stickers", "static", "gn", "gnfigurinhas", "gncoleciona", "coleciona",
  // páginas públicas da plataforma (landing e institucionais)
  "colecao", "contato", "cancelamento", "planos", "cadastro", "entrar", "sobre", "precos", "faq", "duvidas", "blog",
  "landing", "home", "inicio", "site",
]);

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
}

// "Figurinhas do Zé!" → "figurinhas-do-ze"
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

/** Mensagem de erro para o endereço gerado, ou null se estiver ok. */
export function slugProblem(slug: string): string | null {
  if (slug.length < 3) return "O nome da loja precisa ter pelo menos 3 letras ou números.";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return "Nome de loja inválido.";
  if (RESERVED_SLUGS.has(slug)) return "Esse nome é reservado pela plataforma — escolha outro.";
  return null;
}
