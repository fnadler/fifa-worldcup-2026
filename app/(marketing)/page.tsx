import type { Metadata } from "next";
import { landing } from "@/content/landing";
import { formatBRL } from "@/lib/shop";
import { getStripe, stripeConfigured, TRIAL_DAYS } from "@/lib/stripe";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import MarketingNav from "@/components/marketing/MarketingNav";
import {
  CollectionSection,
  FaqSection,
  FinalCta,
  Hero,
  Pricing,
  StoreSection,
  ValueSplit,
} from "@/components/marketing/LandingSections";

// Página estática, regenerada de hora em hora (o preço vem do Stripe).
export const revalidate = 3600;

const PRECO_PADRAO = "R$ 19,90"; // usado se o Stripe não estiver configurado/disponível

export const metadata: Metadata = {
  title: landing.meta.title,
  description: landing.meta.description,
  openGraph: {
    title: landing.meta.title,
    description: landing.meta.description,
    url: "https://www.gncoleciona.com.br",
    siteName: "GN Coleciona",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/brand/og.jpg", width: 1200, height: 630, alt: "GN Coleciona" }],
  },
};

async function precoMensal(): Promise<string> {
  if (!stripeConfigured()) return PRECO_PADRAO;
  try {
    const price = await getStripe().prices.retrieve(process.env.STRIPE_PRICE_ID!);
    return price.unit_amount != null ? formatBRL(price.unit_amount) : PRECO_PADRAO;
  } catch {
    return PRECO_PADRAO;
  }
}

export default async function LandingPage() {
  const price = await precoMensal();
  return (
    <>
      <section className="mk-hero">
        <MarketingNav />
        <Hero trialDays={TRIAL_DAYS} />
      </section>
      <ValueSplit />
      <CollectionSection />
      <StoreSection />
      <Pricing price={price} trialDays={TRIAL_DAYS} />
      <FaqSection />
      <FinalCta />
      <MarketingFooter />
    </>
  );
}
