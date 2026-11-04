"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { NAME_MAX, RESERVED_SLUGS, cleanName, slugInput, slugProblem, slugVariation, slugify } from "@/lib/brand";
import { squareImage } from "@/lib/imageResize";
import { createClient } from "@/lib/supabase/client";
import {
  centsToInput,
  isValidPhoneBR,
  maskPhoneBR,
  normalizeWhatsapp,
  parseBRL,
  shopPath,
  type ShopAlbum,
  type ShopSettings,
} from "@/lib/shop";
import { getCatalog } from "@/lib/catalog";
import BrandLogo from "./BrandLogo";

const LOGO_BUCKET = "shop-logos";
// suggested: o endereço do nome está ocupado e o campo já mostra uma variação livre.
type SlugStatus = "idle" | "checking" | "free" | "taken" | "suggested" | "current";

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
  /** Uma entrada por coleção: à venda ou não. */
  albums: ShopAlbum[];
  onAlbumsSaved: (a: ShopAlbum[]) => void;
  onToast: (msg: string) => void;
  /** Repetidas em estoque, itens vendáveis (repetidas com preço + produtos com estoque) e produtos ativos. */
  stockSummary: { repetidas: number; vendaveis: number; produtos: number };
  onGoToPrices: () => void;
}

export default function AdminSettings({
  userId,
  settings,
  onSaved,
  albums,
  onAlbumsSaved,
  onToast,
  stockSummary,
  onGoToPrices,
}: AdminSettingsProps) {
  const [toggling, setToggling] = useState(false);
  const [semVenda, setSemVenda] = useState(false);
  const [sellerName, setSellerName] = useState(settings.sellerName);
  const [whatsapp, setWhatsapp] = useState(maskPhoneBR(settings.whatsapp));
  const [colecoes, setColecoes] = useState(() =>
    albums.map((a) => ({ albumId: a.albumId, enabled: a.enabled }))
  );
  const [minOrder, setMinOrder] = useState(centsToInput(settings.minOrderCents || null));
  const [onlyAvailable, setOnlyAvailable] = useState(settings.onlyAvailable);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  // Endereço escrito à mão; null = segue o nome da loja.
  const [slugDraft, setSlugDraft] = useState<string | null>(null);
  // Primeira variação livre do endereço `base`, quando ele está ocupado.
  const [variacao, setVariacao] = useState<{ base: string; slug: string } | null>(null);
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugFalha, setSlugFalha] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);
  const shopUrl = `${origin}${shopPath(settings)}`;
  const host = origin.replace(/^https?:\/\//, "");

  // Por padrão o endereço é o nome da loja. Uma loja com endereço só muda quando o nome é editado, ou à mão.
  const manual = slugDraft !== null;
  const nomeEditado = cleanName(sellerName) !== cleanName(settings.sellerName);
  const slugBase = manual ? slugify(slugDraft) : !settings.slug || nomeEditado ? slugify(sellerName) : settings.slug;
  const slugLivre = variacao?.base === slugBase ? variacao.slug : null;
  const slug = !manual && slugLivre ? slugLivre : slugBase;
  const slugValue = manual ? slugDraft : slug;
  const baseReservada = RESERVED_SLUGS.has(slugBase);
  const slugErro =
    !manual && baseReservada && !slugLivre ? null : slugValue || manual ? slugProblem(slug) : null;
  const slugAlterado = !!slugValue && slug !== settings.slug;
  // Procura enquanto digita; se o endereço estiver ocupado (ou for reservado), acha a primeira variação livre.
  useEffect(() => {
    if (!slugBase || (slugProblem(slugBase) && !baseReservada)) {
      queueMicrotask(() => setSlugStatus("idle"));
      return;
    }
    if (slugBase === settings.slug) {
      queueMicrotask(() => setSlugStatus("current"));
      return;
    }
    let ativo = true;
    queueMicrotask(() => setSlugStatus("checking"));
    const t = window.setTimeout(async () => {
      const supabase = createClient();
      const livre = async (candidato: string) => {
        const { data } = await supabase.rpc("shop_slug_available", { p_slug: candidato });
        return data !== false;
      };
      if (!baseReservada && (await livre(slugBase))) {
        if (ativo) setSlugStatus("free");
        return;
      }
      for (let n = 2; n <= 50 && ativo; n++) {
        const candidato = slugVariation(slugBase, n);
        if (candidato !== settings.slug && !(await livre(candidato))) continue;
        if (ativo) {
          setVariacao({ base: slugBase, slug: candidato });
          setSlugStatus(manual ? "taken" : "suggested");
        }
        return;
      }
      if (ativo) setSlugStatus("taken");
    }, 400);
    return () => {
      ativo = false;
      window.clearTimeout(t);
    };
  }, [slugBase, baseReservada, manual, settings.slug]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const minimo = parseBRL(minOrder) ?? 0;
    if (Number.isNaN(minimo)) return setError("Pedido mínimo inválido. Use o formato 10,00.");
    // uma loja só de produtos pode ficar sem coleção à venda
    if (!colecoes.some((c) => c.enabled) && stockSummary.produtos === 0) {
      return setError("Deixe ao menos uma coleção à venda (ou cadastre um produto na aba Produtos).");
    }

    if (whatsapp && !isValidPhoneBR(whatsapp)) {
      return setError("WhatsApp inválido. Informe o DDD e o número: (11) 99999-8888.");
    }
    const whats = whatsapp ? normalizeWhatsapp(whatsapp) : "";
    if (settings.enabled && !whats) {
      return setError("A loja está aberta: ela precisa de um WhatsApp para receber os pedidos.");
    }

    const nome = cleanName(sellerName);
    if (!nome) return setError("Dê um nome para a sua loja.");
    if (slugAlterado) {
      if (slugErro) return setError(slugErro);
      if (slugStatus === "taken") return setError("Esse endereço já está em uso. Escolha outro.");
      if (slugStatus === "checking") return setError("Aguarde a verificação do endereço e tente de novo.");
      if (settings.slug) {
        const ok = window.confirm(
          `O endereço da loja vai mudar para ${host}/${slug}. Links já divulgados com o endereço antigo deixam de funcionar. Continuar?`
        );
        if (!ok) return;
      }
    }

    setSaving(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("shops")
      .update({
        seller_name: nome,
        ...(slugAlterado ? { slug } : {}),
        only_available: onlyAvailable,
        whatsapp: whats || null,
        order_min_cents: minimo,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    const albumsError = dbError
      ? null
      : (
          await supabase.from("shop_albums").upsert(
            colecoes.map((c) => ({
              user_id: userId,
              album_id: c.albumId,
              enabled: c.enabled,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "user_id,album_id" }
          )
        ).error;
    setSaving(false);
    if (albumsError) return setError("Não foi possível salvar as coleções à venda — tente de novo.");

    if (dbError) {
      // 23505 = endereço já usado por outra loja (índice único); 23514 = endereço reservado/inválido
      setError(
        dbError.code === "23505"
          ? "Esse endereço já está em uso. Escolha outro."
          : dbError.code === "23514"
            ? "Esse endereço não pode ser usado. Escolha outro."
            : "Não foi possível salvar — tente de novo."
      );
      if (dbError.code === "23505") setSlugStatus("taken");
      return;
    }
    setSellerName(nome);
    setWhatsapp(maskPhoneBR(whats));
    setSlugDraft(null);
    onSaved({
      ...settings,
      sellerName: nome,
      slug: slugAlterado ? slug : settings.slug,
      onlyAvailable,
      whatsapp: whats,
      minOrderCents: minimo,
    });
    onAlbumsSaved(
      albums.map((a) => {
        const c = colecoes.find((x) => x.albumId === a.albumId)!;
        return { ...a, enabled: c.enabled };
      })
    );
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
      const blob = await squareImage(file, 640);
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

  async function salvarEndereco(e: FormEvent) {
    e.preventDefault();
    setSlugFalha(null);
    if (!slugAlterado || slugErro || slugStatus === "taken" || slugStatus === "checking" || savingSlug) return;
    if (settings.slug) {
      const ok = window.confirm(
        `O endereço da loja vai mudar para ${host}/${slug}. Links já divulgados com o endereço antigo deixam de funcionar. Continuar?`
      );
      if (!ok) return;
    }
    setSavingSlug(true);
    const { error: dbError } = await createClient()
      .from("shops")
      .update({ slug, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    setSavingSlug(false);
    if (dbError) {
      // 23505 = endereço já usado por outra loja (índice único); 23514 = endereço reservado/inválido
      if (dbError.code === "23505") setSlugStatus("taken");
      setSlugFalha(
        dbError.code === "23505"
          ? "Esse endereço já está em uso. Escolha outro."
          : dbError.code === "23514"
            ? "Esse endereço não pode ser usado. Escolha outro."
            : "Não foi possível salvar — tente de novo."
      );
      return;
    }
    // Com o nome ainda não salvo, fixa o endereço para o campo não voltar a seguir o nome.
    setSlugDraft(nomeEditado ? slug : null);
    onSaved({ ...settings, slug });
    onToast("Endereço da loja atualizado!");
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
                Você não tem nenhum item repetido para vender. Marque suas repetidas em <em>Minha coleção</em> — só
                elas aparecem à venda.
              </span>
            ) : (
              <>
                <span>
                  Você tem {stockSummary.repetidas} {stockSummary.repetidas === 1 ? "item repetido" : "itens repetidos"}{" "}
                  numa coleção à venda, mas nenhum com preço. Defina um preço por grupo (ex: todas as Seleções) ou
                  individual para ele aparecer na loja.
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
        <form className="shop-link-row" onSubmit={salvarEndereco}>
          {/* O domínio é fixo; o label inteiro leva o toque para o campo, que só tem o que vem depois da barra. */}
          <label className="shop-link-field">
            <span className="shop-link-host">{host}/</span>
            <input
              className="shop-link-slug"
              aria-label="Endereço da loja"
              value={slugValue}
              placeholder="minha-loja"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              onChange={(e) => {
                setSlugFalha(null);
                setSlugDraft(slugInput(e.target.value));
              }}
              onBlur={() => {
                if (slugDraft !== null) setSlugDraft(slugify(slugDraft));
              }}
            />
          </label>
          {slugAlterado || (slugDraft !== null && !slugValue) ? (
            <>
              <button
                type="submit"
                className="btn-primary"
                disabled={!!slugErro || slugStatus === "taken" || slugStatus === "checking" || savingSlug}
              >
                {savingSlug ? "Salvando…" : "Salvar endereço"}
              </button>
              {settings.slug && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    // Fixa o endereço salvo, mesmo com o nome editado.
                    setSlugFalha(null);
                    setSlugDraft(settings.slug);
                  }}
                >
                  Cancelar
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn-primary" onClick={copiarLink}>
                Copiar link
              </button>
              <a className="btn-ghost" href={shopPath(settings)} target="_blank" rel="noopener noreferrer">
                Abrir
              </a>
            </>
          )}
        </form>
        {(slugAlterado || slugErro || slugFalha) && (
          <div className={`slug-preview slug-${slugErro || slugFalha ? "taken" : slugStatus}`}>
            <span className="slug-status">
              {slugFalha ??
                slugErro ??
                (slugStatus === "checking"
                  ? "verificando…"
                  : slugStatus === "free"
                    ? "✓ disponível"
                    : slugStatus === "suggested"
                      ? `“${slugBase}” ${baseReservada ? "é reservado" : "já está em uso"}. Sugerimos esta variação, que está livre.`
                      : slugStatus === "taken"
                        ? "✗ já está em uso"
                        : "")}
            </span>
            {slugStatus === "taken" && slugLivre && !slugFalha && (
              <button type="button" className="slug-use" onClick={() => setSlugDraft(slugLivre)}>
                Usar {slugLivre}
              </button>
            )}
          </div>
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
        </div>

        <div className="shop-albums-settings">
          <span className="form-label">Coleções à venda</span>
          <span className="field-hint">
            Cada coleção tem seus preços (aba Preços). O comprador pode juntar itens de todas as coleções e produtos no
            mesmo pedido.
          </span>
          {colecoes.map((c) => (
            <div key={c.albumId} className="shop-album-row">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) =>
                    setColecoes((cs) => cs.map((x) => (x.albumId === c.albumId ? { ...x, enabled: e.target.checked } : x)))
                  }
                />
                <strong>{getCatalog(c.albumId).name}</strong>
              </label>
            </div>
          ))}
        </div>

        <div className="form-row">
          <label className="form-label">
            Pedido mínimo da loja (R$)
            <input
              className="login-input"
              inputMode="decimal"
              value={minOrder}
              placeholder="0,00"
              onChange={(e) => setMinOrder(e.target.value)}
            />
            <span className="field-hint">Vale para o total do carrinho, somando todas as coleções e produtos. Em branco = sem mínimo.</span>
          </label>
        </div>

        <label className="check-row">
          <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
          <span>
            <strong>Mostrar só o que está à venda</strong>
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
