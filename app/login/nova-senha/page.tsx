import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PLATFORM_NAME } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import NewPasswordForm from "@/components/NewPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Nova senha — ${PLATFORM_NAME}` };

// Chega aqui quem abriu o link de "Esqueci minha senha": o link já abriu a sessão.
export default async function NovaSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?authError=1");

  return <NewPasswordForm email={user.email ?? null} />;
}
