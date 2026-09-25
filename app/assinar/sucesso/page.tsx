import { redirect } from "next/navigation";
import { syncSubscription } from "@/lib/billing";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Volta do checkout do Stripe. Sincroniza a assinatura aqui mesmo (sem esperar o webhook)
// para a loja já abrir liberada, e segue para as configurações da loja.
export default async function AssinaturaSucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!session_id || !stripeConfigured()) redirect("/assinar");

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.client_reference_id !== user.id || !session.subscription) redirect("/assinar");

  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  await syncSubscription(await stripe.subscriptions.retrieve(subId), user.id);
  redirect("/vendas?assinatura=ok");
}
