import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { catalogBySlug } from "@/lib/catalog";
import { ownShop } from "@/lib/shopLink";
import { TRIAL_DAYS } from "@/lib/stripe";
import { collectionTitleOf, userCollections } from "@/lib/userCollections";
import AlbumApp from "@/components/AlbumApp";

export const dynamic = "force-dynamic";

// ?lojas=1 abre a coleção já com "Lojas com o que falta" (Quero comprar) aberto — link do e-mail.
// ?guia=loja abre o guia da loja (quem veio vender: depois da escolha das coleções).
export default async function ColecaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lojas?: string; guia?: string }>;
}) {
  const [{ slug }, { lojas, guia }] = await Promise.all([params, searchParams]);
  const abrirLojas = lojas === "1";
  const catalog = catalogBySlug(slug);
  if (!catalog) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/colecao/${slug}${abrirLojas ? "?lojas=1" : ""}`)}`);

  const [collections, shop] = await Promise.all([userCollections(supabase, user.id), ownShop(supabase, user.id)]);
  const current = collections.find((c) => c.albumId === catalog.id);
  // Coleção que a pessoa ainda não tem: oferece adicionar.
  if (!current) redirect(`/colecoes?adicionar=${slug}`);

  return (
    <AlbumApp
      key={catalog.id}
      initialUser={{ id: user.id, email: user.email ?? null }}
      shopHref={shop.href}
      shopActive={shop.active}
      collectionName={collectionTitleOf(current)}
      albumId={catalog.id}
      collections={collections}
      openShopsOnLoad={abrirLojas}
      // quem já tem a loja não precisa do guia
      guiaLoja={guia === "loja" && !shop.active ? { trialDays: TRIAL_DAYS } : null}
    />
  );
}
