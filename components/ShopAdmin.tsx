"use client";

import { HeaderActions, NavSwitch } from "./HeaderIcons";
import UserMenu from "./UserMenu";
import { useCallback, useMemo, useState } from "react";
import { isExpired, priceFor, shopPath, type GroupPrices, type Order, type ShopSettings } from "@/lib/shop";
import { useNow } from "@/lib/useNow";
import type { Qtd } from "@/lib/types";
import AdminOrders from "./AdminOrders";
import AdminPrices from "./AdminPrices";
import AdminSettings from "./AdminSettings";
import BrandLogo from "./BrandLogo";
import { DEFAULT_SHOP_NAME, PLATFORM_NAME } from "@/lib/brand";

interface ShopAdminProps {
  userId: string;
  email: string | null;
  /** Acabou de assinar (volta do checkout): mostra boas-vindas e abre nas configurações. */
  welcome?: boolean;
  initialSettings: ShopSettings;
  initialGroupPrices: GroupPrices;
  initialIndividual: Record<string, number>;
  initialOrders: Order[];
  initialAvailable: Qtd;
}

type Aba = "pedidos" | "precos" | "config";

export default function ShopAdmin({
  userId,
  email,
  welcome = false,
  initialSettings,
  initialGroupPrices,
  initialIndividual,
  initialOrders,
  initialAvailable,
}: ShopAdminProps) {
  const [aba, setAba] = useState<Aba>(welcome || !initialSettings.whatsapp ? "config" : "pedidos");
  const [bemVindo, setBemVindo] = useState(welcome);
  const [settings, setSettings] = useState(initialSettings);
  const [orders, setOrders] = useState(initialOrders);
  const [available, setAvailable] = useState(initialAvailable);
  const [groupPrices, setGroupPrices] = useState(initialGroupPrices);
  const [individual, setIndividual] = useState(initialIndividual);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((current) => (current === msg ? null : current)), 4000);
  }, []);

  const now = useNow();
  // Para abrir a loja é preciso ao menos 1 repetida em estoque com preço (grupo ou individual).
  const stockSummary = useMemo(() => {
    const codes = Object.keys(available).filter((c) => (available[c] ?? 0) > 0);
    const pricing = { group: groupPrices, individual };
    return { repetidas: codes.length, vendaveis: codes.filter((c) => priceFor(c, pricing) !== null).length };
  }, [available, groupPrices, individual]);

  const novos = orders.filter((o) => o.status === "novo" && !isExpired(o, now)).length;

  const ABAS: { value: Aba; label: string }[] = [
    { value: "pedidos", label: novos ? `Pedidos (${novos})` : "Pedidos" },
    { value: "precos", label: "Preços" },
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
              <UserMenu email={email} shopSettings />
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
          pricing={{ group: groupPrices, individual }}
          onOrdersChange={setOrders}
          onAvailableChange={setAvailable}
          onToast={showToast}
        />
      )}
      {aba === "precos" && (
        <AdminPrices
          userId={userId}
          group={groupPrices}
          setGroup={setGroupPrices}
          individual={individual}
          setIndividual={setIndividual}
          available={available}
          onToast={showToast}
        />
      )}
      {aba === "config" && (
        <AdminSettings
          userId={userId}
          settings={settings}
          onSaved={setSettings}
          onToast={showToast}
          stockSummary={stockSummary}
          onGoToPrices={() => setAba("precos")}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
