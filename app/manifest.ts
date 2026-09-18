import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Álbum Copa 2026 — Controle de repetidas",
    short_name: "Copa 2026",
    description: "Controle pessoal de figurinhas coladas e repetidas do álbum da Copa 2026.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a120e",
    theme_color: "#0a120e",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
