import { isValidPhoneBR, normalizeWhatsapp } from "./phone";

// Dados de perfil guardados no user_metadata do Supabase Auth (sem tabela própria).
export interface ProfileData {
  full_name: string;
  whatsapp: string; // só dígitos, com DDI (5511999998888)
}

export function profileFromMetadata(meta: Record<string, unknown> | undefined): ProfileData {
  return {
    full_name: typeof meta?.full_name === "string" ? meta.full_name : "",
    whatsapp: typeof meta?.whatsapp === "string" ? meta.whatsapp : "",
  };
}

// Valida e normaliza o que o usuário digitou. Retorna a mensagem de erro ou os dados prontos.
export function parseProfileInput(fullName: string, whatsapp: string): { error: string } | { data: ProfileData } {
  const nome = fullName.trim().replace(/\s+/g, " ");
  if (nome.split(" ").length < 2) return { error: "Informe o nome completo (nome e sobrenome)." };
  if (nome.length > 120) return { error: "Nome muito longo." };
  if (!isValidPhoneBR(whatsapp)) return { error: "WhatsApp inválido. Informe o DDD e o número: (11) 99999-8888." };
  return { data: { full_name: nome, whatsapp: normalizeWhatsapp(whatsapp) } };
}
