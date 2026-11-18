import { Figtree, Nunito } from "next/font/google";

// Páginas públicas dos pacotes: mesma identidade da landing (Nunito nos títulos, Figtree no texto).
const nunito = Nunito({ weight: ["700", "800", "900"], subsets: ["latin"], variable: "--font-nunito" });
const figtree = Figtree({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-figtree" });

export default function PacksLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${nunito.variable} ${figtree.variable}`}>{children}</div>;
}
