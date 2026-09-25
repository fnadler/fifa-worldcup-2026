import Link from "next/link";
import { COMPANY } from "@/content/legal";

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
        </nav>
        <small>
          GN Coleciona é um serviço de {COMPANY.razaoSocial} · CNPJ {COMPANY.cnpj}. Não somos afiliados à Panini nem à
          FIFA; marcas e imagens pertencem aos respectivos titulares.
        </small>
      </div>
    </footer>
  );
}
