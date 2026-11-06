import type { Metadata } from "next";
import Link from "next/link";
import { landing } from "@/content/landing";
import { COLLECTION_PATH, SIGNUP_PATH, signupThen } from "@/lib/routes";
import { TRIAL_DAYS } from "@/lib/stripe";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import MarketingNav from "@/components/marketing/MarketingNav";
import { CollectionsGrid } from "@/components/marketing/LandingSections";
import { SmartLink } from "@/components/marketing/Session";

// Lista completa das coleções, aberta pelo card "Mais coleções" da landing. Fora do menu de propósito.

export const metadata: Metadata = {
  title: "Coleções disponíveis — GN Coleciona",
  description: `Os ${landing.colecoes.items.length} álbuns e coleções da GN Coleciona: Copas de 1990 a 2026, Legends, Extra Stickers, Gold Crumple Edition e Adrenalyn XL.`,
};

export default function ColecoesDisponiveisPage() {
  const p = landing.colecoes.pagina;
  return (
    <>
      <header className="mk-legal-top">
        <MarketingNav anchorsBase="/" />
      </header>
      <main className="mk-lojas mk-container">
        <Link href="/#colecoes" className="mk-back">
          ← {p.voltar}
        </Link>
        <div className="mk-section-head">
          <span className="mk-kicker">{p.kicker}</span>
          <h1 className="mk-h2">{p.title}</h1>
          <p>{p.subtitle}</p>
        </div>
        <CollectionsGrid />
        <div className="mk-ctas">
          <SmartLink
            className="mk-btn mk-btn-green"
            anon={{ href: SIGNUP_PATH, label: "Criar coleção grátis" }}
            authed={{ href: COLLECTION_PATH, label: "Ir para minha coleção" }}
          />
          <SmartLink
            className="mk-btn mk-btn-ghost-green"
            anon={{ href: signupThen("/assinar"), label: `Abrir minha loja — ${TRIAL_DAYS} dias grátis` }}
            authed={{ href: "/assinar", label: `Abrir minha loja — ${TRIAL_DAYS} dias grátis` }}
          />
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
