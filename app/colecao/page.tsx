import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_PATH, needsOnboarding } from "@/lib/onboarding";
import { profileFromMetadata } from "@/lib/profile";
import { LAST_COLLECTION_COOKIE, ensureDefaultCollection, userCollections } from "@/lib/userCollections";

export const dynamic = "force-dynamic";

// /colecao abre a última coleção usada (cookie) ou a primeira da pessoa.
export default async function ColecaoIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  // conta nova: primeiro escolhe as coleções
  if (needsOnboarding(user.user_metadata)) redirect(ONBOARDING_PATH);

  let collections = await userCollections(supabase, user.id);
  if (!collections.length) {
    await ensureDefaultCollection(supabase, user.id, profileFromMetadata(user.user_metadata).collection_name);
    collections = await userCollections(supabase, user.id);
  }
  if (!collections.length) redirect("/colecoes");

  const last = (await cookies()).get(LAST_COLLECTION_COOKIE)?.value;
  const target = collections.find((c) => c.slug === last) ?? collections[0];
  redirect(`/colecao/${target.slug}`);
}
