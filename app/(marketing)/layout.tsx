import { Figtree, Nunito } from "next/font/google";
import { SessionProvider } from "@/components/marketing/Session";
import "./marketing.css";

// Área pública (landing e institucionais): visual claro próprio e fontes carregadas só aqui,
// para não pesar no app logado.
const nunito = Nunito({ weight: ["700", "800", "900"], subsets: ["latin"], variable: "--font-nunito" });
const figtree = Figtree({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-figtree" });

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mk ${nunito.variable} ${figtree.variable}`}>
      <SessionProvider>{children}</SessionProvider>
    </div>
  );
}
