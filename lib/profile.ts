import { DEFAULT_COLLECTION_NAME, NAME_MAX, cleanName } from "./brand";
import { isValidPhoneBR, normalizeWhatsapp } from "./phone";

// Dados de perfil guardados no user_metadata do Supabase Auth (sem tabela própria).
export interface ProfileData {
  full_name: string;
  whatsapp: string; // só dígitos, com DDI (5511999998888)
  collection_name: string;
  /** Coleção (álbum) que a pessoa está montando — ver tabela albums. */
  album_id?: string;
}

export function profileFromMetadata(meta: Record<string, unknown> | undefined): ProfileData {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    full_name: str(meta?.full_name),
    whatsapp: str(meta?.whatsapp),
    collection_name: str(meta?.collection_name),
    album_id: str(meta?.album_id) || undefined,
  };
}

/** Título do álbum: o nome que o usuário deu à coleção, ou o padrão. */
export function collectionTitle(meta: Record<string, unknown> | undefined): string {
  return profileFromMetadata(meta).collection_name || DEFAULT_COLLECTION_NAME;
}

// Valida e normaliza o que o usuário digitou. Retorna a mensagem de erro ou os dados prontos.
export function parseProfileInput(
  fullName: string,
  whatsapp: string,
  collectionName: string
): { error: string } | { data: ProfileData } {
  const nome = fullName.trim().replace(/\s+/g, " ");
  if (nome.split(" ").length < 2) return { error: "Informe o nome completo (nome e sobrenome)." };
  if (nome.length > 120) return { error: "Nome muito longo." };
  if (!isValidPhoneBR(whatsapp)) return { error: "WhatsApp inválido. Informe o DDD e o número: (11) 99999-8888." };
  const colecao = cleanName(collectionName);
  if (colecao.length < 2) return { error: "Dê um nome para a sua coleção (ex: Coleção do João)." };
  if (collectionName.trim().length > NAME_MAX) return { error: `O nome da coleção pode ter até ${NAME_MAX} caracteres.` };
  return { data: { full_name: nome, whatsapp: normalizeWhatsapp(whatsapp), collection_name: colecao } };
}
