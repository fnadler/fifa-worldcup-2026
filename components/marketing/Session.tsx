"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// A landing é estática (rápida e boa para SEO). A sessão é lida no navegador depois de
// carregar: até lá, os botões mostram a versão de visitante e trocam em seguida.
const SessionContext = createContext(false);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [logado, setLogado] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => setLogado(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setLogado(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return <SessionContext.Provider value={logado}>{children}</SessionContext.Provider>;
}

export function useLoggedIn(): boolean {
  return useContext(SessionContext);
}

interface Destino {
  href: string;
  label: string;
}

/** Link que muda de destino/texto conforme a pessoa esteja logada (ver "Mapa dos CTAs"). */
export function SmartLink({ anon, authed, className }: { anon: Destino; authed?: Destino; className?: string }) {
  const logado = useLoggedIn();
  const d = logado && authed ? authed : anon;
  return (
    <Link href={d.href} className={className}>
      {d.label}
    </Link>
  );
}

/** Mostra o conteúdo só para quem NÃO está logado (ex: "Entrar" na nav). */
export function AnonOnly({ children }: { children: ReactNode }) {
  return useLoggedIn() ? null : <>{children}</>;
}
