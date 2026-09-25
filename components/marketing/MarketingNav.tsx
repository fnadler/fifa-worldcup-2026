import Link from "next/link";
import { landing } from "@/content/landing";
import { COLLECTION_PATH, signupThen } from "@/lib/routes";
import { TRIAL_DAYS } from "@/lib/stripe";
import MarketingLogo from "./Logo";
import { AnonOnly, SmartLink } from "./Session";

// Topo da área pública. Na landing mostra as âncoras das seções; nas páginas institucionais,
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
      </div>
      <div className="mk-nav-actions">
        <AnonOnly>
          <Link href="/login" className="mk-nav-login">
            Entrar
          </Link>
        </AnonOnly>
        <SmartLink
          className="mk-btn mk-btn-sm mk-btn-yellow"
          anon={{ href: signupThen("/assinar"), label: `Testar ${TRIAL_DAYS} dias grátis` }}
          authed={{ href: COLLECTION_PATH, label: "Ir para minha coleção" }}
        />
      </div>
    </nav>
  );
}
