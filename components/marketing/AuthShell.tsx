import Link from "next/link";
import type { ReactNode } from "react";
import MarketingLogo from "./Logo";

// Moldura das telas de acesso (entrar, criar conta, esqueci a senha, senha nova), no visual da landing:
// fundo verde com o logo e um cartão branco no centro.
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mk-hero mk-auth">
      <header className="mk-auth-top mk-container">
        <MarketingLogo />
        <Link href="/" className="mk-auth-back">
          ← Voltar ao site
        </Link>
      </header>
      <main className="mk-auth-main">
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
