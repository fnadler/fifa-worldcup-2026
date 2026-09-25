"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { isExpired, type GroupPrices, type Order, type ShopSettings } from "@/lib/shop";
import { useNow } from "@/lib/useNow";
import type { Qtd } from "@/lib/types";
import AdminOrders from "./AdminOrders";
import AdminPrices from "./AdminPrices";
import AdminSettings from "./AdminSettings";
import BrandLogo from "./BrandLogo";

interface ShopAdminProps {
  userId: string;
  initialSettings: ShopSettings;
  initialGroupPrices: GroupPrices;
  initialIndividual: Record<string, number>;
  initialOrders: Order[];
  initialAvailable: Qtd;
}

type Aba = "pedidos" | "precos" | "config";

export default function ShopAdmin({
  userId,
  initialSettings,
  initialGroupPrices,
  initialIndividual,
  initialOrders,
  initialAvailable,
}: ShopAdminProps) {
  const [aba, setAba] = useState<Aba>(initialSettings.whatsapp ? "pedidos" : "config");
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
              <BrandLogo />
              <span className="kicker">Loja · administração</span>
              <span className="title">Álbum Copa 2026</span>
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
            <div className="admin-back">
              <Link href="/" className="btn-ghost">
                Meu álbum
              </Link>
              <Link href={`/loja/${settings.token}`} className="btn-ghost">
                Minha loja
              </Link>
            </div>
          </div>
        </div>
      </div>

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
        <AdminSettings userId={userId} settings={settings} onSaved={setSettings} onToast={showToast} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
