"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { cropImage } from "@/lib/imageResize";
import {
  MAX_PRODUCTS,
  PRODUCT_COLUMNS,
  PRODUCT_DESCRIPTION_MAX,
  PRODUCT_STOCK_MAX,
  PRODUCT_TITLE_MAX,
  centsToInput,
  formatBRL,
  parseBRL,
  productFromRow,
  type ShopProduct,
  type ShopProductRow,
} from "@/lib/shop";
import { createClient } from "@/lib/supabase/client";
import type { Qtd } from "@/lib/types";

// Produtos especiais da loja (kits, dispensers…): cadastro simples com imagem, título, descrição,
// preço e estoque. O estoque fica no mesmo mapa das repetidas (por código), que a aba Pedidos atualiza
// ao confirmar ou cancelar uma venda.

const BUCKET = "shop-products";

// Caminho do arquivo dentro do bucket, a partir da URL pública (para apagar a imagem anterior).
function pathFromUrl(url: string | null): string | null {
  const marker = `/${BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split("?")[0]) : null;
}

interface AdminProductsProps {
  userId: string;
  products: ShopProduct[];
  setProducts: Dispatch<SetStateAction<ShopProduct[]>>;
  /** Estoque por código (repetidas e produtos). */
  stock: Qtd;
  setStock: Dispatch<SetStateAction<Qtd>>;
  /** Reservado em pedidos novos, por código. */
  reserved: Record<string, number>;
  onToast: (msg: string) => void;
}

interface Draft {
  id: string | null;
  title: string;
  description: string;
  price: string;
  stock: string;
  active: boolean;
  imageUrl: string | null;
  /** Imagem escolhida e ainda não enviada. */
  file: Blob | null;
  preview: string | null;
}

const EMPTY: Draft = { id: null, title: "", description: "", price: "", stock: "1", active: true, imageUrl: null, file: null, preview: null };

export default function AdminProducts({ userId, products, setProducts, stock, setStock, reserved, onToast }: AdminProductsProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function editar(p: ShopProduct) {
    setError(null);
    setDraft({
      id: p.id,
      title: p.title,
      description: p.description,
      price: centsToInput(p.priceCents),
      stock: String(stock[p.code] ?? 0),
      active: p.active,
      imageUrl: p.imageUrl,
      file: null,
      preview: null,
    });
  }

  function fechar() {
    if (draft?.preview) URL.revokeObjectURL(draft.preview);
    setDraft(null);
    setError(null);
  }

  async function escolherImagem(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !draft) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setError("Use uma imagem PNG, JPG ou WebP.");
    if (file.size > 10 * 1024 * 1024) return setError("Imagem grande demais (máx. 10 MB).");
    try {
      const blob = await cropImage(file, 800, 1000); // 4:5, como aparece na loja
      if (draft.preview) URL.revokeObjectURL(draft.preview);
      setDraft({ ...draft, file: blob, preview: URL.createObjectURL(blob) });
      setError(null);
    } catch {
      setError("Não foi possível ler essa imagem — tente outra.");
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    const title = draft.title.trim().replace(/\s+/g, " ");
    if (title.length < 2) return setError("Dê um título para o produto.");
    const cents = parseBRL(draft.price);
    if (cents === null || Number.isNaN(cents)) return setError("Preço inválido. Use o formato 49,90.");
    const qtd = Number(draft.stock);
    if (!Number.isInteger(qtd) || qtd < 0 || qtd > PRODUCT_STOCK_MAX) return setError(`Estoque inválido. Use um número de 0 a ${PRODUCT_STOCK_MAX}.`);

    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      let imageUrl = draft.imageUrl;
      if (draft.file) {
        const ext = draft.file.type === "image/png" ? "png" : "webp";
        const path = `${userId}/produto-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, draft.file, { contentType: draft.file.type });
        if (upErr) throw upErr;
        imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }

      const values = {
        title,
        description: draft.description.trim(),
        price_cents: cents,
        stock: qtd,
        active: draft.active,
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      };
      const query = draft.id
        ? supabase.from("shop_products").update(values).eq("id", draft.id).eq("user_id", userId)
        : supabase.from("shop_products").insert({ ...values, user_id: userId, position: products.length });
      const { data, error: dbErr } = await query.select(PRODUCT_COLUMNS).single<ShopProductRow>();
      if (dbErr || !data) {
        // não deixa a imagem recém-enviada órfã
        if (draft.file && imageUrl) void supabase.storage.from(BUCKET).remove([pathFromUrl(imageUrl)!]);
        setError(
          dbErr?.message.includes("LIMITE_PRODUTOS")
            ? `Cada loja pode ter até ${MAX_PRODUCTS} produtos. Exclua um para cadastrar outro.`
            : "Não foi possível salvar o produto — tente de novo."
        );
        return;
      }
      // trocou a imagem: apaga a anterior
      const anterior = draft.file ? pathFromUrl(draft.imageUrl) : null;
      if (anterior) void supabase.storage.from(BUCKET).remove([anterior]);

      const saved = productFromRow(data);
      setProducts((prev) => (draft.id ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]));
      setStock((prev) => {
        const next = { ...prev };
        if (saved.stock > 0) next[saved.code] = saved.stock;
        else delete next[saved.code];
        return next;
      });
      onToast(draft.id ? "Produto atualizado!" : "Produto cadastrado!");
      fechar();
    } catch {
      setError("Não foi possível enviar a imagem — tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(p: ShopProduct) {
    const emPedido = reserved[p.code] ?? 0;
    const aviso = emPedido
      ? `"${p.title}" está em pedidos novos (${emPedido} unidade${emPedido > 1 ? "s" : ""} reservada${emPedido > 1 ? "s" : ""}). Se excluir, esses pedidos continuam, mas sem controle de estoque. Excluir mesmo assim?`
      : `Excluir "${p.title}"? Não dá para desfazer.`;
    if (!window.confirm(aviso)) return;
    const supabase = createClient();
    const { error: dbErr } = await supabase.from("shop_products").delete().eq("id", p.id).eq("user_id", userId);
    if (dbErr) return onToast("Não foi possível excluir o produto — tente de novo.");
    const img = pathFromUrl(p.imageUrl);
    if (img) void supabase.storage.from(BUCKET).remove([img]);
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    setStock((prev) => {
      const next = { ...prev };
      delete next[p.code];
      return next;
    });
    onToast("Produto excluído.");
  }

  const img = draft?.preview ?? draft?.imageUrl ?? null;

  return (
    <div className="admin-page">
      <section className="admin-section">
        <div className="collections-head">
          <h2 className="admin-section-title">Produtos especiais</h2>
          <button
            type="button"
            className="btn-primary"
            disabled={products.length >= MAX_PRODUCTS}
            onClick={() => {
              setError(null);
              setDraft(EMPTY);
            }}
          >
            + Novo produto
          </button>
        </div>
        <p className="modal-notice">
          Kits, dispensers, álbuns e outros itens que você vende além das figurinhas. Eles aparecem na aba “Produtos” da
          loja e entram no mesmo carrinho e no mesmo pedido. O estoque é reservado no carrinho e no pedido, e a baixa
          acontece quando você confirma a venda.
        </p>

        {products.length === 0 && <div className="empty-message">Nenhum produto cadastrado ainda.</div>}

        <div className="admin-products">
          {products.map((p) => {
            const qtd = stock[p.code] ?? 0;
            const res = reserved[p.code] ?? 0;
            return (
              <article key={p.id} className={`admin-product${p.active ? "" : " is-off"}`}>
                <div className="admin-product-img">
                  {p.imageUrl ? <Image src={p.imageUrl} alt="" width={160} height={200} unoptimized /> : <span aria-hidden="true">📦</span>}
                </div>
                <div className="admin-product-info">
                  <strong>{p.title}</strong>
                  <span>
                    {formatBRL(p.priceCents)} · {qtd} em estoque
                    {res > 0 && ` (${res} reservado${res > 1 ? "s" : ""} em pedidos)`}
                  </span>
                  <span className={`admin-product-status${p.active && qtd > 0 ? " is-on" : ""}`}>
                    {!p.active ? "Pausado — não aparece na loja" : qtd === 0 ? "Sem estoque — aparece como esgotado" : "À venda"}
                  </span>
                </div>
                <div className="admin-product-actions">
                  <button type="button" className="btn-ghost" onClick={() => editar(p)}>
                    Editar
                  </button>
                  <button type="button" className="collection-option-remove" onClick={() => void excluir(p)}>
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {draft && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={draft.id ? "Editar produto" : "Novo produto"} onClick={() => !saving && fechar()}>
          <form className="modal-card product-form" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
            <div className="modal-header">
              <span className="modal-title">{draft.id ? "Editar produto" : "Novo produto"}</span>
              <div className="modal-header-spacer" />
              <button type="button" className="modal-close" onClick={fechar} aria-label="Fechar" disabled={saving}>
                ×
              </button>
            </div>

            <div className="product-form-image">
              <div className="admin-product-img is-large">{img ? <Image src={img} alt="" width={240} height={300} unoptimized /> : <span aria-hidden="true">📦</span>}</div>
              <div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={escolherImagem} />
                <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
                  {img ? "Trocar imagem" : "Escolher imagem"}
                </button>
                <span className="field-hint">Formato retrato (4:5) fica melhor. A imagem é recortada no centro.</span>
              </div>
            </div>

            <label className="form-label">
              Título
              <input
                className="login-input"
                required
                maxLength={PRODUCT_TITLE_MAX}
                placeholder="Ex: Kit com 50 envelopes"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label className="form-label">
              Descrição
              <textarea
                className="login-input product-form-desc"
                rows={4}
                maxLength={PRODUCT_DESCRIPTION_MAX}
                placeholder="O que vem no produto, tamanho, condição…"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <div className="form-row">
              <label className="form-label">
                Preço (R$)
                <input
                  className="login-input"
                  required
                  inputMode="decimal"
                  placeholder="49,90"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                />
              </label>
              <label className="form-label">
                Estoque (unidades)
                <input
                  className="login-input"
                  required
                  inputMode="numeric"
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/\D/g, "") })}
                />
              </label>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              <span>
                <strong>À venda na loja</strong>
                <span className="field-hint">Desmarque para pausar o produto sem excluir.</span>
              </span>
            </label>

            {error && <div className="login-error">{error}</div>}

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={fechar} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn-restore" disabled={saving}>
                {saving ? "Salvando…" : "Salvar produto"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
