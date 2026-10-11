import Link from "next/link";
import { COMPANY } from "@/content/legal";
import { INSTAGRAM_URL } from "@/lib/community";

export default function MarketingFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <strong>GN Coleciona</strong>
        <nav aria-label="Institucional">
          <Link href="/termos">Termos de uso</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/cancelamento">Cancelamento e reembolso</Link>
          <Link href="/contato">Contato</Link>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="mk-footer-social">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
            </svg>
            Instagram
          </a>
        </nav>
        <small>
          GN Coleciona é um serviço de {COMPANY.razaoSocial} · CNPJ {COMPANY.cnpj}. Não somos afiliados à Panini nem à
          FIFA; marcas e imagens pertencem aos respectivos titulares.
        </small>
      </div>
    </footer>
  );
}
