import type { Metadata } from "next";
import { landing } from "@/content/landing";
import { formatBRL } from "@/lib/shop";
import { getStripe, stripeConfigured, TRIAL_DAYS } from "@/lib/stripe";
import { type DirectoryShop, listShops } from "@/lib/shopDirectory";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import MarketingNav from "@/components/marketing/MarketingNav";
import {
  CollectionSection,
  CollectionsAvailable,
  CommunitySection,
  FaqSection,
  FinalCta,
  Hero,
  Pricing,
  ShopsSection,
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

// Sem lojas (ou se a consulta falhar) o bloco de lojistas some — a landing não pode quebrar por ele.
async function lojas(): Promise<DirectoryShop[]> {
  try {
    return await listShops();
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const [price, shops] = await Promise.all([precoMensal(), lojas()]);
  return (
    <>
      <section className="mk-hero">
        <MarketingNav />
        <Hero trialDays={TRIAL_DAYS} />
      </section>
      <ValueSplit />
      <CollectionsAvailable />
      <CollectionSection />
      <StoreSection />
      <Pricing price={price} trialDays={TRIAL_DAYS} />
      <FaqSection />
      <ShopsSection shops={shops} trialDays={TRIAL_DAYS} />
      <CommunitySection />
      <FinalCta />
      <MarketingFooter />
    </>
  );
}
