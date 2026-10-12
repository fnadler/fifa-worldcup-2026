"use client";

import { HeaderActions, NavSwitch } from "./HeaderIcons";
import UserMenu from "./UserMenu";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  groupsOf,
  isExpired,
  isProductCode,
  priceFor,
  productsPricing,
  reservedByCode,
  shopPath,
  type GroupPrices,
  type Order,
  type ShopAlbum,
  type ShopProduct,
  type ShopSettings,
} from "@/lib/shop";
import { getCatalog, lookupCode } from "@/lib/catalog";
import { CatalogProvider } from "@/lib/CatalogContext";
import type { SetStateAction } from "react";
import { useNow } from "@/lib/useNow";
import type { Qtd } from "@/lib/types";
import AdminOrders from "./AdminOrders";
import AdminPrices from "./AdminPrices";
import AdminProducts from "./AdminProducts";
import AdminSettings from "./AdminSettings";
import BrandLogo from "./BrandLogo";
import { DEFAULT_SHOP_NAME, PLATFORM_NAME } from "@/lib/brand";

interface ShopAdminProps {
  userId: string;
  email: string | null;
  /** Acabou de assinar (volta do checkout): mostra boas-vindas e abre nas configurações. */
  welcome?: boolean;
  /** Aba pedida na URL (?aba=pedidos|precos|produtos|config), ex: vindo do menu do usuário. */
  initialTab?: string;
  initialSettings: ShopSettings;
  /** Uma entrada por coleção da plataforma (shop_albums). */
  initialAlbums: ShopAlbum[];
  initialIndividual: Record<string, number>;
  initialOrders: Order[];
  /** Estoque por código: repetidas (qty - 1) e produtos. */
  initialAvailable: Qtd;
  initialProducts: ShopProduct[];
}

type Aba = "pedidos" | "precos" | "produtos" | "config";

const isAba = (v: string | null | undefined): v is Aba =>
  v === "pedidos" || v === "precos" || v === "produtos" || v === "config";

export default function ShopAdmin({
  userId,
  email,
  welcome = false,
  initialTab,
  initialSettings,
  initialAlbums,
  initialIndividual,
  initialOrders,
  initialAvailable,
  initialProducts,
}: ShopAdminProps) {
  const [aba, setAba] = useState<Aba>(
    isAba(initialTab) ? initialTab : welcome || !initialSettings.whatsapp ? "config" : "pedidos"
  );
  // O menu do usuário leva a /vendas?aba=…; se já estamos na página, só troca a aba.
  const params = useSearchParams();
  const abaNaUrl = params.get("aba");
  useEffect(() => {
    if (isAba(abaNaUrl)) queueMicrotask(() => setAba(abaNaUrl));
  }, [abaNaUrl]);
  const [bemVindo, setBemVindo] = useState(welcome);
  const [settings, setSettings] = useState(initialSettings);
  const [orders, setOrders] = useState(initialOrders);
  const [available, setAvailable] = useState(initialAvailable);
  const [albums, setAlbums] = useState(initialAlbums);
  const [products, setProducts] = useState(initialProducts);
  // Coleção mostrada na aba Preços: a primeira à venda.
  const [precoAlbum, setPrecoAlbum] = useState(
    () => (initialAlbums.find((a) => a.enabled) ?? initialAlbums[0]).albumId
  );
  const albumPreco = albums.find((a) => a.albumId === precoAlbum) ?? albums[0];
  const setGroupPrices = (g: SetStateAction<GroupPrices>) =>
    setAlbums((as) =>
      as.map((a) => (a.albumId === precoAlbum ? { ...a, groupPrices: typeof g === "function" ? g(a.groupPrices) : g } : a))
    );
  const [individual, setIndividual] = useState(initialIndividual);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((current) => (current === msg ? null : current)), 4000);
  }, []);

  const now = useNow();
  // Preços das coleções à venda e dos produtos ativos (pedidos e resumo de estoque).
  const pricing = useMemo(
    () => ({ groups: groupsOf(albums), individual, products: productsPricing(products.filter((p) => p.active)) }),
    [albums, individual, products]
  );

  // Para abrir a loja é preciso ao menos 1 item vendável: repetida com preço numa coleção à venda,
  // ou produto ativo com estoque.
  const stockSummary = useMemo(() => {
    const aVenda = new Set(albums.filter((a) => a.enabled).map((a) => a.albumId));
    const codes = Object.keys(available).filter((c) => (available[c] ?? 0) > 0);
    const repetidas = codes.filter((c) => !isProductCode(c));
    const vendaveis = codes.filter(
      (c) => priceFor(c, pricing) !== null && (isProductCode(c) || aVenda.has(lookupCode(c)?.catalog.id ?? ""))
    );
    return { repetidas: repetidas.length, vendaveis: vendaveis.length, produtos: products.filter((p) => p.active).length };
  }, [albums, available, pricing, products]);

  const novos = orders.filter((o) => o.status === "novo" && !isExpired(o, now)).length;

  const ABAS: { value: Aba; label: string }[] = [
    { value: "pedidos", label: novos ? `Pedidos (${novos})` : "Pedidos" },
    { value: "precos", label: "Preços" },
    { value: "produtos", label: products.length ? `Produtos (${products.length})` : "Produtos" },
    { value: "config", label: "Configurações" },
  ];

  return (
    <div className="app-shell">
      <div className="header">
        <div className="header-inner">
          <div className="header-main-row">
            <div className="brand">
              <BrandLogo src={settings.logoUrl} />
              <span className="kicker">{PLATFORM_NAME}</span>
              <span className="title">{settings.sellerName || DEFAULT_SHOP_NAME}</span>
            </div>
            <div className="segmented admin-tabs">
              {ABAS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  className={`chip ${aba === a.value ? "active" : ""}`}
                  onClick={() => setAba(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <span className={`shop-status-pill ${settings.enabled ? "is-on" : ""}`}>
              {settings.enabled ? "Loja aberta" : "Loja pausada"}
            </span>
            <HeaderActions>
              <NavSwitch active={null} shopHref={shopPath(settings)} />
              <UserMenu email={email} shopActive />
            </HeaderActions>
          </div>
        </div>
      </div>

      {bemVindo && (
        <div className="owner-banner welcome-banner">
          <strong>Assinatura ativada! 🎉</strong> Agora defina o nome da loja, o WhatsApp e os preços, e abra a loja.
          <button type="button" className="modal-close" onClick={() => setBemVindo(false)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}

      {aba === "pedidos" && (
        <AdminOrders
          orders={orders}
          stock={available}
          pricing={pricing}
          onOrdersChange={setOrders}
          onAvailableChange={setAvailable}
          onToast={showToast}
        />
      )}
      {aba === "precos" && (
        <CatalogProvider value={getCatalog(albumPreco.albumId)}>
          {albums.length > 1 && (
            <div className="admin-album-picker">
              <div className="segmented">
                {albums.map((a) => (
                  <button
                    key={a.albumId}
                    type="button"
                    className={`chip ${a.albumId === albumPreco.albumId ? "active" : ""}`}
                    onClick={() => setPrecoAlbum(a.albumId)}
                  >
                    {getCatalog(a.albumId).name}
                  </button>
                ))}
              </div>
              {!albumPreco.enabled && (
                <span className="field-hint">
                  Esta coleção não está à venda — os preços ficam guardados; ative em{" "}
                  <button type="button" className="link-button" onClick={() => setAba("config")}>
                    Configurações
                  </button>
                  .
                </span>
              )}
            </div>
          )}
        <AdminPrices
          key={albumPreco.albumId}
          userId={userId}
          album={albumPreco}
          group={albumPreco.groupPrices}
          setGroup={setGroupPrices}
          individual={individual}
          setIndividual={setIndividual}
          available={available}
          onToast={showToast}
        />
        </CatalogProvider>
      )}
      {aba === "produtos" && (
        <AdminProducts
          userId={userId}
          products={products}
          setProducts={setProducts}
          stock={available}
          setStock={setAvailable}
          reserved={reservedByCode(orders, now)}
          onToast={showToast}
        />
      )}
      {aba === "config" && (
        <AdminSettings
          userId={userId}
          settings={settings}
          onSaved={setSettings}
          albums={albums}
          onAlbumsSaved={setAlbums}
          onToast={showToast}
          stockSummary={stockSummary}
          onGoToPrices={() => setAba("precos")}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
