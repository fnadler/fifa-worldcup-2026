"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { NAME_MAX, cleanName, slugProblem, slugify } from "@/lib/brand";
import { squareImage } from "@/lib/imageResize";
import { createClient } from "@/lib/supabase/client";
import {
  centsToInput,
  isValidPhoneBR,
  maskPhoneBR,
  normalizeWhatsapp,
  parseBRL,
  shopPath,
  type ShopSettings,
} from "@/lib/shop";
import BrandLogo from "./BrandLogo";

const LOGO_BUCKET = "shop-logos";
type SlugStatus = "idle" | "checking" | "free" | "taken" | "current";

// Caminho do arquivo dentro do bucket, a partir da URL pública (para apagar a imagem anterior).
function logoPathFromUrl(url: string | null): string | null {
  const marker = `/${LOGO_BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split("?")[0]) : null;
}

interface AdminSettingsProps {
  userId: string;
  settings: ShopSettings;
  onSaved: (s: ShopSettings) => void;
  onToast: (msg: string) => void;
  /** Repetidas em estoque e quantas delas têm preço (grupo ou individual). */
  stockSummary: { repetidas: number; vendaveis: number };
  onGoToPrices: () => void;
}

export default function AdminSettings({
  userId,
  settings,
  onSaved,
  onToast,
  stockSummary,
  onGoToPrices,
}: AdminSettingsProps) {
  const [toggling, setToggling] = useState(false);
  const [semVenda, setSemVenda] = useState(false);
  const [sellerName, setSellerName] = useState(settings.sellerName);
  const [whatsapp, setWhatsapp] = useState(maskPhoneBR(settings.whatsapp));
  const [minOrder, setMinOrder] = useState(centsToInput(settings.minOrderCents || null));
  const [onlyAvailable, setOnlyAvailable] = useState(settings.onlyAvailable);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);
  const shopUrl = `${origin}${shopPath(settings)}`;
  const host = origin.replace(/^https?:\/\//, "");

  // Endereço gerado a partir do nome, com checagem de disponibilidade enquanto digita.
  const slug = slugify(sellerName);
  const slugErro = sellerName.trim() ? slugProblem(slug) : null;
  useEffect(() => {
    if (!slug || slugErro) {
      queueMicrotask(() => setSlugStatus("idle"));
      return;
    }
    if (slug === settings.slug) {
      queueMicrotask(() => setSlugStatus("current"));
      return;
    }
    queueMicrotask(() => setSlugStatus("checking"));
    const t = window.setTimeout(async () => {
      const { data } = await createClient().rpc("shop_slug_available", { p_slug: slug });
      setSlugStatus(data === false ? "taken" : "free");
    }, 400);
    return () => window.clearTimeout(t);
  }, [slug, slugErro, settings.slug]);

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

    const nome = cleanName(sellerName);
    if (!nome) return setError("Dê um nome para a sua loja — ele também define o endereço dela.");
    if (slugErro) return setError(slugErro);
    if (slugStatus === "taken") return setError("Esse nome de loja já está em uso. Escolha outro.");
    if (settings.slug && slug !== settings.slug) {
      const ok = window.confirm(
        `O endereço da loja vai mudar para ${host}/${slug}. Links já divulgados com o endereço antigo deixam de funcionar. Continuar?`
      );
      if (!ok) return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("shops")
      .update({
        seller_name: nome,
        slug,
        only_available: onlyAvailable,
        whatsapp: whats || null,
        min_order_cents: minCents,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setSaving(false);

    if (dbError) {
      // 23505 = endereço já usado por outra loja (índice único); 23514 = endereço reservado/inválido
      setError(
        dbError.code === "23505"
          ? "Esse nome de loja já está em uso. Escolha outro."
          : dbError.code === "23514"
            ? "Esse nome não pode ser usado como endereço da loja. Escolha outro."
            : "Não foi possível salvar — tente de novo."
      );
      if (dbError.code === "23505") setSlugStatus("taken");
      return;
    }
    setSellerName(nome);
    setWhatsapp(maskPhoneBR(whats));
    onSaved({ ...settings, sellerName: nome, slug, onlyAvailable, whatsapp: whats, minOrderCents: minCents });
    onToast("Configurações salvas!");
  }

  // Abre/fecha na hora (independente do "Salvar configurações").
  async function alternarLoja() {
    const abrir = !settings.enabled;
    if (abrir && stockSummary.vendaveis === 0) {
      setSemVenda(true);
      return;
    }
    if (abrir && (!settings.whatsapp || !settings.slug)) {
      onToast("Antes de abrir a loja, salve o nome da loja e o WhatsApp nas configurações abaixo.");
      return;
    }
    setSemVenda(false);
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

  async function enviarLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return onToast("Use uma imagem PNG, JPG ou WebP.");
    if (file.size > 10 * 1024 * 1024) return onToast("Imagem grande demais (máx. 10 MB).");

    setUploading(true);
    try {
      const blob = await squareImage(file, 256);
      const ext = blob.type === "image/png" ? "png" : "webp";
      const path = `${userId}/logo-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(LOGO_BUCKET).upload(path, blob, { contentType: blob.type });
      if (upErr) throw upErr;
      const url = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
      const { error: dbErr } = await supabase.from("shops").update({ logo_url: url }).eq("user_id", userId);
      if (dbErr) throw dbErr;
      const anterior = logoPathFromUrl(settings.logoUrl);
      if (anterior) void supabase.storage.from(LOGO_BUCKET).remove([anterior]);
      onSaved({ ...settings, logoUrl: url });
      onToast("Imagem da loja atualizada!");
    } catch {
      onToast("Não foi possível enviar a imagem — tente de novo.");
    } finally {
      setUploading(false);
    }
  }

  async function removerLogo() {
    const supabase = createClient();
    const { error: dbErr } = await supabase.from("shops").update({ logo_url: null }).eq("user_id", userId);
    if (dbErr) return onToast("Não foi possível remover a imagem — tente de novo.");
    const anterior = logoPathFromUrl(settings.logoUrl);
    if (anterior) void supabase.storage.from(LOGO_BUCKET).remove([anterior]);
    onSaved({ ...settings, logoUrl: null });
    onToast("Imagem removida — a loja volta a usar o logo padrão.");
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
        {semVenda && !settings.enabled && stockSummary.vendaveis === 0 && (
          <div className="open-blocked" role="alert">
            <strong>Ainda não dá para abrir a loja.</strong>
            {stockSummary.repetidas === 0 ? (
              <span>
                Você não tem nenhuma figurinha repetida para vender. Marque suas repetidas em <em>Minha coleção</em> —
                só elas aparecem à venda.
              </span>
            ) : (
              <>
                <span>
                  Você tem {stockSummary.repetidas} figurinha{stockSummary.repetidas === 1 ? "" : "s"} repetida
                  {stockSummary.repetidas === 1 ? "" : "s"}, mas nenhuma com preço. Defina um preço por grupo (ex: todas
                  as Seleções) ou por figurinha para ela aparecer na loja.
                </span>
                <button type="button" className="btn-primary" onClick={onGoToPrices}>
                  Definir preços
                </button>
              </>
            )}
          </div>
        )}
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
          <a className="btn-ghost" href={shopPath(settings)} target="_blank" rel="noopener noreferrer">
            Abrir
          </a>
        </div>
        {!settings.slug && (
          <span className="cart-note">Defina o nome da loja abaixo para ganhar um endereço amigável.</span>
        )}
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Imagem da loja</h2>
        <div className="logo-row">
          <BrandLogo src={settings.logoUrl} />
          <div className="logo-row-info">
            <p className="modal-notice">
              Aparece no topo da sua loja, no lugar do logo padrão. Use uma imagem quadrada (ela é recortada no centro).
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Enviando…" : settings.logoUrl ? "Trocar imagem" : "Enviar imagem"}
              </button>
              {settings.logoUrl && (
                <button type="button" className="btn-ghost" onClick={() => void removerLogo()} disabled={uploading}>
                  Remover
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="visually-hidden"
            onChange={(e) => void enviarLogo(e)}
          />
        </div>
      </section>

      <form className="admin-section admin-settings-form" onSubmit={salvar}>
        <h2 className="admin-section-title">Configurações</h2>

        <label className="form-label">
          Nome da loja{" "}
          <span className="field-hint">
            aparece no topo da loja e define o endereço · {sellerName.length}/{NAME_MAX}
          </span>
          <input
            className="login-input"
            value={sellerName}
            maxLength={NAME_MAX}
            placeholder="Ex: Figurinhas do João"
            onChange={(e) => setSellerName(e.target.value)}
          />
        </label>
        {sellerName.trim() && (
          <div className={`slug-preview slug-${slugErro ? "taken" : slugStatus}`}>
            <span className="slug-url">
              {host}/<strong>{slug || "…"}</strong>
            </span>
            <span className="slug-status">
              {slugErro ??
                (slugStatus === "checking"
                  ? "verificando…"
                  : slugStatus === "free"
                    ? "✓ disponível"
                    : slugStatus === "taken"
                      ? "✗ já está em uso"
                      : slugStatus === "current"
                        ? "endereço atual"
                        : "")}
            </span>
          </div>
        )}

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

        <label className="check-row">
          <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
          <span>
            <strong>Mostrar só as figurinhas à venda</strong>
            <span className="field-hint">
              A loja exibe apenas o que tem preço e estoque — ideal se você vende só um tipo (ex: só Legends). Sem
              marcar, o comprador vê o catálogo completo e pode filtrar.
            </span>
          </span>
        </label>

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
