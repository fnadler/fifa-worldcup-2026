"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { COMMUNITY_URL, INSTAGRAM_URL } from "@/lib/community";
import { Icon } from "./HeaderIcons";

interface UserMenuProps {
  email: string | null;
  /** Loja ativa (assinatura/acesso): mostra o grupo "Minha loja" completo; senão, só "Assine já". */
  shopActive: boolean;
}

export async function signOut() {
  await createClient().auth.signOut();
  window.location.href = "/login";
}

const LOJA_ITENS = [
  { href: "/vendas?aba=pedidos", label: "Pedidos" },
  { href: "/vendas?aba=precos", label: "Definir preços" },
  { href: "/vendas?aba=config", label: "Configurações" },
  { href: "/assinatura", label: "Assinatura" },
];

// Celular: o menu vira uma tela cheia com rolagem (mesmo corte do CSS).
const MOBILE_QUERY = "(max-width: 700px)";

function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export default function UserMenu({ email, shopActive }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  );

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      // no celular o menu é renderizado fora do cabeçalho (portal), então confere os dois
      if (!rootRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // tela cheia aberta: a página de trás não rola
  useEffect(() => {
    if (!open || !mobile) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [open, mobile]);

  const fechar = () => setOpen(false);

  const itens = (
    <>
          {email && <span className="auth-status">{email}</span>}

          <Link href="/perfil" className="user-menu-item" role="menuitem" onClick={fechar}>
            Meu perfil
          </Link>
          <Link href="/colecoes" className="user-menu-item" role="menuitem" onClick={fechar}>
            Minhas coleções
          </Link>
          <div className="user-menu-group" role="group" aria-label="Minha loja">
            <span className="user-menu-group-title">Minha loja</span>
            {shopActive ? (
              LOJA_ITENS.map((i) => (
                <Link key={i.href} href={i.href} className="user-menu-item" role="menuitem" onClick={fechar}>
                  {i.label}
                </Link>
              ))
            ) : (
              <Link href="/assinar" className="user-menu-item user-menu-cta" role="menuitem" onClick={fechar}>
                Assine já
              </Link>
            )}
          </div>

          <div className="user-menu-group" role="group" aria-label="GN Coleciona">
            <span className="user-menu-group-title">GN Coleciona</span>
            {COMMUNITY_URL && (
              <a
                href={COMMUNITY_URL}
                className="user-menu-item user-menu-community"
                role="menuitem"
                target="_blank"
                rel="noopener noreferrer"
                onClick={fechar}
              >
                <Icon name="whatsapp" />
                Comunidade no WhatsApp
              </a>
            )}
            <Link href="/" className="user-menu-item" role="menuitem" onClick={fechar}>
              Ir para o site
            </Link>
            <a href={INSTAGRAM_URL} className="user-menu-item" role="menuitem" target="_blank" rel="noopener noreferrer" onClick={fechar}>
              Instagram
            </a>
          </div>

          <button type="button" className="user-menu-item user-menu-signout" role="menuitem" onClick={() => void signOut()}>
            Sair
          </button>
    </>
  );

  return (
    <div className="user-menu-root" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        onClick={() => setOpen((v) => !v)}
        title="Minha conta"
        aria-label="Minha conta"
        aria-expanded={open}
      >
        <Icon name="user" />
      </button>
      {open &&
        (mobile ? (
          // fora do cabeçalho: o blur dele prenderia a tela cheia dentro da própria faixa
          createPortal(
            <div className="user-menu user-menu-sheet" role="dialog" aria-modal="true" aria-label="Minha conta" ref={menuRef}>
              <div className="user-menu-sheet-head">
                <strong>Minha conta</strong>
                <button type="button" className="icon-button" onClick={fechar} aria-label="Fechar menu">
                  ×
                </button>
              </div>
              {itens}
            </div>,
            document.body
          )
        ) : (
          <div className="user-menu" role="menu" ref={menuRef}>
            {itens}
          </div>
        ))}
    </div>
  );
}
