// Primeira vez depois do cadastro: a pessoa escolhe as coleções (com a capa de cada álbum) antes de abrir
// o quadro. O cadastro grava `onboarding: "pending"` no user_metadata; a tela de escolha troca para "done".
// Contas antigas não têm a marca e seguem direto para a coleção.

export const ONBOARDING_PATH = "/colecoes/comecar";

export function needsOnboarding(meta: Record<string, unknown> | undefined): boolean {
  return meta?.onboarding === "pending";
}
