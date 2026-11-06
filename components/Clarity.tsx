"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CLARITY_ID, clarityIdentify, claritySet, clarityTagAttribution, ensureClarityQueue } from "@/lib/clarityClient";
import { readSignupAttribution } from "@/lib/metaClient";
import { createClient } from "@/lib/supabase/client";

// Único ponto que carrega o Microsoft Clarity. Sem NEXT_PUBLIC_CLARITY_PROJECT_ID não renderiza nada.
// Marca cada página com a origem da visita (cookies de atribuição) e, com sessão aberta, liga a
// gravação ao user_id da conta.
export default function Clarity() {
  const pathname = usePathname();
  const userId = useRef<string | null>(null);

  useEffect(() => {
    if (!CLARITY_ID) return;
    ensureClarityQueue();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      claritySet("logado", id ? "sim" : "nao");
      if (id && id !== userId.current) clarityIdentify(id);
      userId.current = id;
    });
    return () => data.subscription.unsubscribe();
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
