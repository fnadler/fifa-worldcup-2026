import Link from "next/link";
import type { ReactNode } from "react";
import { landing } from "@/content/landing";
import HeroMock from "./HeroMock";
import MarketingLogo from "./Logo";

// Moldura das telas de acesso. Desktop: duas metades — à esquerda o painel da marca (verde da landing,
// com a ilustração ou, no cadastro, os benefícios de criar a conta); à direita, o formulário.
// No celular o painel vira só uma faixa com o logo.

export type AuthVariant = "signin" | "signup" | "forgot";

function Panel({ variant }: { variant: AuthVariant }) {
  const a = landing.auth;
  if (variant === "signup") {
    return (
      <>
        <div className="mk-auth-pitch">
          <span className="mk-pill">{a.signup.pill}</span>
          <h2>{a.signup.title}</h2>
        </div>
        <ul className="mk-auth-benefits">
          {a.signup.benefits.map((b) => (
            <li key={b.t}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>{b.t}</strong>
                <p>{b.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <>
      <div className="mk-auth-pitch">
        <h2>{a.signin.title}</h2>
        <p>{a.signin.subtitle}</p>
      </div>
      <HeroMock />
    </>
  );
}

export default function AuthShell({
  title,
  subtitle,
  variant = "signin",
  children,
}: {
  title: string;
  subtitle: string;
  variant?: AuthVariant;
  children: ReactNode;
}) {
  return (
    <div className="mk-auth">
      <aside className="mk-hero mk-auth-side">
        <MarketingLogo />
        <div className="mk-auth-side-body">
          <Panel variant={variant} />
        </div>
        <span className="mk-auth-side-foot">{landing.auth.foot}</span>
      </aside>
      <main className="mk-auth-main">
        <Link href="/" className="mk-auth-back">
          ← Voltar ao site
        </Link>
        <div className="mk-auth-card">
          <div className="mk-auth-head">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
