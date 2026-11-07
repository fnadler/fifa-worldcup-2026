import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

// Ajudas comuns aos e-mails para a base (lojas com o que falta, ativação).

/**
 * Primeiro nome do cadastro, com a inicial maiúscula ("ILTON" ou "ilton" → "Ilton"). Quem pôs o e-mail ou
 * um usuário no lugar do nome ("ferdinand.barros") vira "Ferdinand"; com número, fica sem nome ("Olá!").
 */
export function firstNameOf(user: User): string | null {
  const nome = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const primeiro = nome ? nome.split(/[\s._@]+/)[0] : "";
  if (!primeiro || /\d/.test(primeiro)) return null;
  return primeiro === primeiro.toUpperCase() || primeiro === primeiro.toLowerCase()
    ? primeiro.charAt(0).toLocaleUpperCase("pt-BR") + primeiro.slice(1).toLocaleLowerCase("pt-BR")
    : primeiro;
}

export async function listAllUsers(): Promise<User[]> {
  const admin = createAdminClient();
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const alvo = email.trim().toLowerCase();
  return (await listAllUsers()).find((u) => u.email?.toLowerCase() === alvo) ?? null;
}

/** Grava em app_metadata (só o servidor escreve) a data e o id de um envio único. */
export async function markSent(user: User, key: string, emailId: string): Promise<void> {
  await createAdminClient().auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, [key]: new Date().toISOString(), [`${key}_id`]: emailId },
  });
}

export const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
