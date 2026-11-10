"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { CLARITY_ID, clarityIdentify, claritySet, clarityTagAttribution, ensureClarityQueue } from "@/lib/clarityClient";
import { readSignupAttribution } from "@/lib/metaClient";
import { temCookieDeSessao } from "@/lib/supabase/sessao";

// Único ponto que carrega o Microsoft Clarity. Sem NEXT_PUBLIC_CLARITY_PROJECT_ID não renderiza nada.
// Marca cada página com a origem da visita (cookies de atribuição) e, com sessão aberta, liga a
// gravação ao user_id da conta.
// O cliente do Supabase (~65 KB) só é baixado quando há cookie de sessão: quem chega de um anúncio não
// está logado e não paga esse peso. A checagem se repete a cada página, para quem faz login no meio da
// visita passar a ter a gravação ligada à conta.
export default function Clarity() {
  const pathname = usePathname();
  const userId = useRef<string | null>(null);

  // geracao muda a cada desmontagem: um import que termine depois disso não se inscreve.
  const geracao = useRef(0);
  const desligar = useRef<(() => void) | null>(null);

  // Liga o Clarity à sessão do Supabase (uma vez), se houver cookie de sessão. Devolve se ligou.
  const ligarSessao = useCallback(() => {
    if (desligar.current || !temCookieDeSessao()) return false;
    desligar.current = () => {}; // marca como ligado enquanto o cliente carrega
    const minha = geracao.current;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (minha !== geracao.current) return;
      const { data } = createClient().auth.onAuthStateChange((_event, session) => {
        const id = session?.user.id ?? null;
        claritySet("logado", id ? "sim" : "nao");
        if (id && id !== userId.current) clarityIdentify(id);
        userId.current = id;
      });
      desligar.current = () => data.subscription.unsubscribe();
    });
    return true;
  }, []);

  useEffect(() => {
    if (!CLARITY_ID) return;
    ensureClarityQueue();
    if (!ligarSessao()) claritySet("logado", "nao");
    const contador = geracao;
    return () => {
      contador.current++;
      desligar.current?.();
      desligar.current = null;
    };
  }, [ligarSessao]);

  // A cada página (inclusive navegação client-side): origem atual e o usuário, como o Clarity pede. Quem
  // acabou de fazer login passa a ter o cookie: liga a sessão aqui.
  useEffect(() => {
    if (!CLARITY_ID) return;
    clarityTagAttribution(readSignupAttribution());
    ligarSessao();
    if (userId.current) clarityIdentify(userId.current);
  }, [pathname, ligarSessao]);

  if (!CLARITY_ID) return null;
  return <Script id="ms-clarity" src={`https://www.clarity.ms/tag/${CLARITY_ID}`} strategy="afterInteractive" />;
}
