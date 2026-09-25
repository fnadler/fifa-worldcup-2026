"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { centsToInput, isValidPhoneBR, maskPhoneBR, normalizeWhatsapp, parseBRL, type ShopSettings } from "@/lib/shop";

interface AdminSettingsProps {
  userId: string;
  settings: ShopSettings;
  onSaved: (s: ShopSettings) => void;
  onToast: (msg: string) => void;
}

export default function AdminSettings({ userId, settings, onSaved, onToast }: AdminSettingsProps) {
  const [toggling, setToggling] = useState(false);
  const [sellerName, setSellerName] = useState(settings.sellerName);
  const [whatsapp, setWhatsapp] = useState(maskPhoneBR(settings.whatsapp));
  const [minOrder, setMinOrder] = useState(centsToInput(settings.minOrderCents || null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);
  const shopUrl = `${origin}/loja/${settings.token}`;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const minCents = parseBRL(minOrder) ?? 0;
    if (Number.isNaN(minCents)) return setError("Valor mínimo inválido. Use o formato 10,00.");

    if (whatsapp && !isValidPhoneBR(whatsapp)) {
      return setError("WhatsApp inválido. Informe o DDD e o número: (11) 99999-8888.");
    }
    const whats = whatsapp ? normalizeWhatsapp(whatsapp) : "";
    if (settings.enabled && !whats) {
      return setError("A loja está aberta: ela precisa de um WhatsApp para receber os pedidos.");
    }

    setSaving(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("shops")
      .update({
        seller_name: sellerName.trim() || null,
        whatsapp: whats || null,
        min_order_cents: minCents,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setSaving(false);

    if (dbError) {
      setError("Não foi possível salvar — tente de novo.");
      return;
    }
    setWhatsapp(maskPhoneBR(whats));
    onSaved({ ...settings, sellerName: sellerName.trim(), whatsapp: whats, minOrderCents: minCents });
    onToast("Configurações salvas!");
  }

  // Abre/fecha na hora (independente do "Salvar configurações").
  async function alternarLoja() {
    const abrir = !settings.enabled;
    if (abrir && !settings.whatsapp) {
      onToast("Salve um WhatsApp nas configurações antes de abrir a loja — é para lá que os pedidos vão.");
      return;
    }
    setToggling(true);
    const { error: dbError } = await createClient()
      .from("shops")
      .update({ enabled: abrir, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    setToggling(false);
    if (dbError) {
      onToast("Não foi possível alterar o status da loja — tente de novo.");
      return;
    }
    onSaved({ ...settings, enabled: abrir });
    onToast(abrir ? "Loja aberta! Já está recebendo pedidos." : "Loja fechada. O link agora mostra “loja pausada”.");
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(shopUrl);
      onToast("Link da loja copiado para a área de transferência!");
    } catch {
      onToast(`Link da loja: ${shopUrl}`);
    }
  }

  return (
    <div className="admin-page">
      <section className={`admin-section shop-status-section ${settings.enabled ? "is-open" : ""}`}>
        <div className="shop-status-info">
          <h2 className="admin-section-title">
            Loja {settings.enabled ? "aberta" : "fechada"}
            <span className={`shop-status-dot ${settings.enabled ? "is-on" : ""}`} aria-hidden="true" />
          </h2>
          <p className="modal-notice">
            {settings.enabled
              ? "Compradores com o link podem ver o catálogo e fazer pedidos."
              : "O link mostra “loja pausada” e não aceita pedidos. Pedidos já feitos continuam valendo."}
          </p>
        </div>
        <button
          type="button"
          className={settings.enabled ? "btn-ghost shop-toggle-close" : "btn-restore"}
          onClick={() => void alternarLoja()}
          disabled={toggling}
        >
          {toggling ? "Aguarde…" : settings.enabled ? "Fechar loja" : "Abrir loja"}
        </button>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Link da loja</h2>
        <p className="modal-notice">
          Este link é diferente do link público de visualização: ele mostra o catálogo com preços e permite fazer
          pedidos. Só aparecem à venda as suas <strong>repetidas</strong> que tenham preço definido.
        </p>
        <div className="shop-link-row">
          <input className="login-input shop-link-input" readOnly value={shopUrl} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn-primary" onClick={copiarLink}>
            Copiar link
          </button>
          <a className="btn-ghost" href={`/loja/${settings.token}`} target="_blank" rel="noopener noreferrer">
            Abrir
          </a>
        </div>
      </section>

      <form className="admin-section admin-settings-form" onSubmit={salvar}>
        <h2 className="admin-section-title">Configurações</h2>

        <label className="form-label">
          Nome exibido na loja (opcional)
          <input
            className="login-input"
            value={sellerName}
            maxLength={60}
            placeholder="Ex: Figurinhas do João"
            onChange={(e) => setSellerName(e.target.value)}
          />
        </label>

        <div className="form-row">
          <label className="form-label">
            WhatsApp que recebe os pedidos
            <input
              className="login-input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={whatsapp}
              placeholder="(11) 99999-8888"
              maxLength={15}
              onChange={(e) => setWhatsapp(maskPhoneBR(e.target.value))}
            />
          </label>
          <label className="form-label">
            Valor mínimo do pedido (R$)
            <input
              className="login-input"
              inputMode="decimal"
              value={minOrder}
              placeholder="0,00"
              onChange={(e) => setMinOrder(e.target.value)}
            />
          </label>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="modal-actions">
          <button type="submit" className="btn-restore" disabled={saving}>
            {saving ? "Salvando…" : "Salvar configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}
