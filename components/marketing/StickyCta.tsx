"use client";

import { useEffect, useState } from "react";
import { SmartLink } from "./Session";

interface Destino {
  href: string;
  label: string;
}

// CTA fixo no rodapé da tela, só no celular (ver .mk-sticky-cta): aparece depois que a pessoa rola
// além do topo verde — na primeira dobra o botão do hero já cumpre esse papel.
export default function StickyCta({ anon, authed }: { anon: Destino; authed: Destino }) {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".mk-hero");
    const onScroll = () => {
      const limite = hero ? hero.offsetTop + hero.offsetHeight - window.innerHeight / 2 : 300;
      setVisivel(window.scrollY > limite);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div className={`mk-sticky-cta${visivel ? " on" : ""}`} aria-hidden={!visivel}>
      <SmartLink className="mk-btn mk-btn-yellow" anon={anon} authed={authed} />
    </div>
  );
}
