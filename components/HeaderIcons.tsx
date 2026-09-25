"use client";

import Link from "next/link";
import { COLLECTION_PATH } from "@/lib/routes";
import { useState, type ReactNode } from "react";

const PATHS = {
  store: (
    <>
      <path d="M4 9h16l-1.2 10.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 9Z" />
      <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
    </>
  ),
  album: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 3v18M12.5 8h4M12.5 12h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>
  ),
  check: <path d="M5 12.5 10 17 19 7" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

// Link de navegação em formato de ícone redondo (rótulo vira tooltip + aria-label).
export function IconLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} className="icon-button" title={label} aria-label={label}>
      <Icon name={icon} />
    </Link>
  );
}

// Alternância entre as duas áreas do usuário (ícone + texto; no celular, só o ícone).
// `active` null = nenhuma das duas (ex: perfil, configurações da loja).
export function NavSwitch({ active, shopHref }: { active: "album" | "shop" | null; shopHref: string }) {
  const itens = [
    { key: "album" as const, href: COLLECTION_PATH, icon: "album" as const, label: "Minha coleção" },
    { key: "shop" as const, href: shopHref, icon: "store" as const, label: "Minha loja" },
  ];
  return (
    <nav className="nav-switch" aria-label="Alternar entre álbum e loja">
      {itens.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`nav-switch-item ${active === i.key ? "is-active" : ""}`}
          aria-current={active === i.key ? "page" : undefined}
          title={i.label}
        >
          <Icon name={i.icon} />
          <span className="header-label">{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// Grupo de ícones do cabeçalho — ocupa o lugar do antigo menu de conta.
export function HeaderActions({ children }: { children: ReactNode }) {
  return <div className="header-actions">{children}</div>;
}

interface CopyLinkButtonProps {
  label: string;
  /** URL pronta, ou função que a obtém (ex: gerar o token do link público na hora). */
  url: string | (() => Promise<string>);
  successMessage: string;
  onToast: (msg: string) => void;
  /** Texto visível ao lado do ícone (some no celular). Sem ele, o botão é só o ícone. */
  text?: string;
}

export function CopyLinkButton({ label, url, successMessage, onToast, text }: CopyLinkButtonProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copiar() {
    if (busy) return;
    setBusy(true);
    try {
      const resolved = typeof url === "string" ? url : await url();
      try {
        await navigator.clipboard.writeText(resolved);
        onToast(successMessage);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        onToast(`Link: ${resolved}`);
      }
    } catch {
      onToast("Não foi possível gerar o link — tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={text ? "header-button" : "icon-button"}
      onClick={copiar}
      disabled={busy}
      title={label}
      aria-label={label}
    >
      <Icon name={copied ? "check" : "link"} />
      {text && <span className="header-label">{copied ? "Copiado!" : text}</span>}
    </button>
  );
}
