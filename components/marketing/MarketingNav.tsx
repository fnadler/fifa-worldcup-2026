import Link from "next/link";
import { landing } from "@/content/landing";
import { COLLECTION_PATH, signupThen } from "@/lib/routes";
import { TRIAL_DAYS } from "@/lib/stripe";
import MarketingLogo from "./Logo";
import StickyCta from "./StickyCta";
import { AnonOnly, SmartLink } from "./Session";

const CTA = {
  anon: { href: signupThen("/assinar"), label: `Testar ${TRIAL_DAYS} dias grátis` },
  authed: { href: COLLECTION_PATH, label: "Ir para minha coleção" },
};

// Topo da área pública. No celular, o CTA sai do topo e vira um botão fixo no rodapé ao rolar.
// Hierarquia no desktop: links de texto (Lojas com selo "novo") → Entrar (secundário) → CTA (primário).
// Na landing mostra as âncoras das seções; nas páginas institucionais,
// links de volta para as seções da home.
export default function MarketingNav({ anchorsBase = "" }: { anchorsBase?: string }) {
  return (
    <nav className="mk-nav mk-container" aria-label="Principal">
      <MarketingLogo />
      <div className="mk-nav-links">
        {landing.nav.map((l) => (
          <a key={l.href} href={`${anchorsBase}${l.href}`}>
            {l.label}
          </a>
        ))}
        <Link href={landing.lojas.href} className="mk-nav-lojas">
          {landing.lojas.label}
          <em>{landing.lojas.badge}</em>
        </Link>
      </div>
      <div className="mk-nav-actions">
        {/* no celular os links somem; as lojas ficam ao lado do logo */}
        <Link href={landing.lojas.href} className="mk-nav-official">
          <span aria-hidden="true">★</span>
          {landing.lojas.label}
        </Link>
        <AnonOnly>
          <Link href="/login" className="mk-nav-login">
            Entrar
          </Link>
        </AnonOnly>
        <SmartLink className="mk-btn mk-btn-sm mk-btn-yellow mk-nav-cta" anon={CTA.anon} authed={CTA.authed} />
      </div>
      <StickyCta anon={CTA.anon} authed={CTA.authed} />
    </nav>
  );
}
