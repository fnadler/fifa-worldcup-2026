"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { COMMUNITY_URL, INSTAGRAM_URL } from "@/lib/community";
import { Icon } from "./HeaderIcons";

interface UserMenuProps {
  email: string | null;
  /** Loja ativa (assinatura/acesso): mostra o grupo "Minha loja" completo; senão, só "Assine já". */
  shopActive: boolean;
  /** Só no álbum: exportar/importar a base de figurinhas. */
  onBackup?: () => void;
  onImport?: () => void;
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

export default function UserMenu({ email, shopActive, onBackup, onImport }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  const fechar = () => setOpen(false);

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
      {open && (
        <div className="user-menu" role="menu">
          {email && <span className="auth-status">{email}</span>}

          <Link href="/perfil" className="user-menu-item" role="menuitem" onClick={fechar}>
            Meu perfil
          </Link>
          <Link href="/colecoes" className="user-menu-item" role="menuitem" onClick={fechar}>
            Minhas coleções
          </Link>
          {COMMUNITY_URL && (
            <a href={COMMUNITY_URL} className="user-menu-item" role="menuitem" target="_blank" rel="noopener noreferrer" onClick={fechar}>
              Comunidade no WhatsApp
            </a>
          )}

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

          {(onBackup || onImport) && (
            <div className="user-menu-group" role="group" aria-label="Coleção">
              <span className="user-menu-group-title">Coleção</span>
              {onBackup && (
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => {
                    fechar();
                    onBackup();
                  }}
                >
                  Backup
                </button>
              )}
              {onImport && (
                <button
                  type="button"
                  className="user-menu-item"
                  role="menuitem"
                  onClick={() => {
                    fechar();
                    onImport();
                  }}
                >
                  Importar
                </button>
              )}
            </div>
          )}

          <div className="user-menu-group" role="group" aria-label="GN Coleciona">
            <span className="user-menu-group-title">GN Coleciona</span>
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
        </div>
      )}
    </div>
  );
}
