import type { Metadata } from "next";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import MarketingNav from "@/components/marketing/MarketingNav";
import ShopDirectory from "@/components/marketing/ShopDirectory";
import { directoryCollections, listShops } from "@/lib/shopDirectory";

// Vitrine das lojas da plataforma. Regenerada a cada 5 minutos (lojas abrem/pausam e o estoque muda).
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Lojas — GN Coleciona",
  description: "Lojas de figurinhas e cards avulsos da GN Coleciona: Álbum da Copa 2026, Gold Crumple Edition, Adrenalyn XL e mais.",
};

export default async function LojasPage() {
  const shops = await listShops();
  return (
    <>
      <header className="mk-legal-top">
        <MarketingNav anchorsBase="/" />
      </header>
      <main className="mk-lojas mk-container">
        <div className="mk-section-head">
          <span className="mk-kicker">Lojas</span>
          <h1 className="mk-h2">Encontre a figurinha que falta.</h1>
          <p>Lojas de colecionadores com repetidas à venda. Escolha a coleção, abra a loja e mande o pedido pelo WhatsApp.</p>
        </div>
        {shops.length ? (
          <ShopDirectory shops={shops} collections={directoryCollections()} />
        ) : (
          <p className="mk-shop-empty">Nenhuma loja aberta no momento. Volte em breve!</p>
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
