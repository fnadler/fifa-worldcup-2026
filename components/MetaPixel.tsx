"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { activatePixel, PIXEL_ID, track } from "@/lib/metaClient";

// Único ponto que carrega o Pixel da Meta (fbevents.js) e dispara PageView, inclusive nas navegações
// client-side. Sem NEXT_PUBLIC_META_PIXEL_ID não renderiza nada. Fica dentro de um <Suspense> no
// layout por causa do useSearchParams.
export default function MetaPixel() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!PIXEL_ID) return;
    activatePixel();
    const url = `${pathname}?${search}`;
    if (last.current === url) return; // StrictMode roda o efeito duas vezes em dev
    last.current = url;
    track("PageView");
  }, [pathname, search]);

  if (!PIXEL_ID) return null;
  return <Script id="meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" />;
}
