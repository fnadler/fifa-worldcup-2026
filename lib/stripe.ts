import "server-only";
import Stripe from "stripe";

// Assinatura mensal da loja. Preço e produto ficam no Stripe (STRIPE_PRICE_ID); o valor
// exibido em /assinar é lido de lá, então trocar o preço não exige deploy.
export const TRIAL_DAYS = 7; // teste grátis, só na primeira assinatura da conta
export const GRACE_DAYS = 3; // carência após falha de cobrança (espelha sync_subscription)

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}
