import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { catalogBySlug } from "@/lib/catalog";
import { ownShop } from "@/lib/shopLink";
import { precosReferencia } from "@/lib/precosReferencia";
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

  if (!user) {
    // volta para a coleção com o que o link pedia (lojas e guia da loja), depois de entrar
    const q = new URLSearchParams();
    if (abrirLojas) q.set("lojas", "1");
    if (guia === "loja") q.set("guia", "loja");
    redirect(`/login?next=${encodeURIComponent(`/colecao/${slug}${q.size ? `?${q}` : ""}`)}`);
  }

  const [collections, shop] = await Promise.all([userCollections(supabase, user.id), ownShop(supabase, user.id)]);
  // Sem loja: preço de referência (convite com o valor das repetidas) e se ainda tem direito ao teste grátis.
  const [precos, { data: assinatura }] = shop.active
    ? [null, { data: null }]
    : await Promise.all([
        precosReferencia(),
        supabase.from("subscriptions").select("stripe_subscription_id").eq("user_id", user.id).maybeSingle<{ stripe_subscription_id: string | null }>(),
      ]);
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
      ofertaLoja={precos ? { precos: { [catalog.id]: precos[catalog.id] ?? {} }, trialDays: assinatura?.stripe_subscription_id ? 0 : TRIAL_DAYS } : null}
    />
  );
}
