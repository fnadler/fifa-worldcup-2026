import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PublicBoard from "@/components/PublicBoard";
import type { Qtd } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: share } = await admin
    .from("collection_shares")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  if (!share) notFound();

  const { data: rows } = await admin
    .from("collection")
    .select("code, qty")
    .eq("user_id", share.user_id);

  const qtd: Qtd = {};
  (rows ?? []).forEach((row) => {
    if (row.qty > 0) qtd[row.code as string] = row.qty as number;
  });

  return <PublicBoard qtd={qtd} />;
}
