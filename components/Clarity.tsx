"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CLARITY_ID, clarityIdentify, claritySet, clarityTagAttribution, ensureClarityQueue } from "@/lib/clarityClient";
import { readSignupAttribution } from "@/lib/metaClient";

// Único ponto que carrega o Microsoft Clarity. Sem NEXT_PUBLIC_CLARITY_PROJECT_ID não renderiza nada.
// Marca cada página com a origem da visita (cookies de atribuição) e, com sessão aberta, liga a
// gravação ao user_id da conta.
// O cliente do Supabase (~65 KB) é importado sob demanda, depois da hidratação, para não entrar no
// JavaScript inicial de todas as páginas (na landing ele pesava sem ser usado na primeira tela).
export default function Clarity() {
  const pathname = usePathname();
  const userId = useRef<string | null>(null);

  useEffect(() => {
    if (!CLARITY_ID) return;
    ensureClarityQueue();
    let ativo = true;
    let cancelar: (() => void) | undefined;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (!ativo) return;
      const { data } = createClient().auth.onAuthStateChange((_event, session) => {
        const id = session?.user.id ?? null;
        claritySet("logado", id ? "sim" : "nao");
        if (id && id !== userId.current) clarityIdentify(id);
        userId.current = id;
      });
      cancelar = () => data.subscription.unsubscribe();
    });
    return () => {
      ativo = false;
      cancelar?.();
    };
  }, []);

  // A cada página (inclusive navegação client-side): origem atual e o usuário, como o Clarity pede.
  useEffect(() => {
    if (!CLARITY_ID) return;
    clarityTagAttribution(readSignupAttribution());
    if (userId.current) clarityIdentify(userId.current);
  }, [pathname]);

  if (!CLARITY_ID) return null;
  return <Script id="ms-clarity" src={`https://www.clarity.ms/tag/${CLARITY_ID}`} strategy="afterInteractive" />;
}
