import type { MetadataRoute } from "next";
import { PLATFORM_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PLATFORM_NAME,
    short_name: PLATFORM_NAME,
    description: "Controle suas figurinhas da Copa 2026 e venda as repetidas.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a120e",
    theme_color: "#0a120e",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
