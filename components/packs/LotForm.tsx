"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { deleteLot, saveLot } from "@/app/vendas/pacotes/actions";
import { inputsFromStartsAt } from "@/lib/auctions";
import { slugInput } from "@/lib/brand";
import { LOT_DESCRIPTION_MAX, LOT_SLUG_MAX, LOT_TITLE_MAX, lotPath, type PackLot } from "@/lib/packs";
import { centsToInput, formatBRL } from "@/lib/shop";

// Dados do lote: nome, endereço, descrição, imagem, preço do pacote, pedido mínimo e início das vendas.

interface Props {
  lot: PackLot | null;
  defaults?: { title: string; slug: string };
  shopSlug: string | null;
  shopMinOrderCents: number;
}

export default function LotForm({ lot, defaults, shopSlug, shopMinOrderCents }: Props) {
  const router = useRouter();
  const when = lot?.startsAt ? inputsFromStartsAt(lot.startsAt) : { date: "", time: "" };
  const [v, setV] = useState({
    title: lot?.title ?? defaults?.title ?? "",
    slug: lot?.slug ?? defaults?.slug ?? "",
    description: lot?.description ?? "",
    price: lot ? centsToInput(lot.priceCents) : "",
    useShopMin: lot ? lot.minOrderCents === null : true,
    minOrder: lot?.minOrderCents != null ? centsToInput(lot.minOrderCents) : "",
    date: when.date,
    time: when.time,
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => {
    setV({ ...v, [k]: k === "slug" ? slugInput(e.target.value) : e.target.value });
    setSaved(false);
  };

  function salvar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const form = new FormData();
    form.set("title", v.title);
    form.set("slug", v.slug.replace(/-+$/, ""));
    form.set("description", v.description);
    form.set("price", v.price);
    form.set("useShopMin", v.useShopMin ? "1" : "");
    form.set("minOrder", v.minOrder);
    form.set("date", v.date);
    form.set("time", v.time);
    if (file) form.set("image", file);
    if (removeImage) form.set("removeImage", "1");
    start(async () => {
      const r = await saveLot(lot?.id ?? null, form);
      if (!r.ok) return setError(r.error);
      if (!lot) return router.push(`/vendas/pacotes/${r.id}`);
      setFile(null);
      setRemoveImage(false);
      setSaved(true);
      router.refresh();
    });
  }

  function excluir() {
    if (!lot) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    start(async () => {
      const r = await deleteLot(lot.id);
      if (!r.ok) return setError(r.error);
      router.push("/vendas/pacotes");
    });
  }

  const path = lotPath(shopSlug, v.slug || "…");
  const imagem = removeImage ? null : file ? URL.createObjectURL(file) : lot?.imageUrl ?? null;

  return (
    <form className="auction-form" onSubmit={salvar}>
      <div className="form-row">
        <label className="form-label">
          Nome do lote
          <input className="login-input" required maxLength={LOT_TITLE_MAX} placeholder="Ex: Lote 1" value={v.title} onChange={set("title")} />
        </label>
        <label className="form-label">
          Endereço
          <input className="login-input" required maxLength={LOT_SLUG_MAX} placeholder="lote-1" value={v.slug} onChange={set("slug")} />
          <small className="pack-hint">{path ? `gncoleciona.com.br${path}` : "Defina o nome da loja para ter o endereço público."}</small>
        </label>
      </div>

      <div className="form-row">
        <label className="form-label form-narrow">
          Preço do pacote (R$)
          <input className="login-input" inputMode="decimal" required placeholder="24,90" value={v.price} onChange={set("price")} />
        </label>
        <label className="form-label form-narrow">
          Início das vendas
          <input className="login-input" type="date" value={v.date} onChange={set("date")} />
        </label>
        <label className="form-label form-narrow">
          Horário
          <input className="login-input" type="time" value={v.time} onChange={set("time")} />
        </label>
      </div>

      <div className="form-row">
        <label className="pack-check">
          <input
            type="checkbox"
            checked={v.useShopMin}
            onChange={(e) => {
              setV({ ...v, useShopMin: e.target.checked });
              setSaved(false);
            }}
          />
          Usar o pedido mínimo da loja ({formatBRL(shopMinOrderCents)})
        </label>
        {!v.useShopMin && (
          <label className="form-label form-narrow">
            Pedido mínimo do lote (R$)
            <input className="login-input" inputMode="decimal" required placeholder="0,00" value={v.minOrder} onChange={set("minOrder")} />
          </label>
        )}
      </div>

      <label className="form-label">
        Descrição
        <textarea
          className="login-input auction-announcement"
          rows={5}
          maxLength={LOT_DESCRIPTION_MAX}
          placeholder="O texto que aparece na página do lote. Ex: 60 pacotes, cada um com 1 Legend garantida e mais 7 figurinhas da Copa 2026."
          value={v.description}
          onChange={set("description")}
        />
      </label>

      <div className="pack-image-row">
        {imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagem} alt="" className="pack-image-preview" />
        ) : (
          <div className="pack-image-preview is-empty">Sem imagem</div>
        )}
        <div className="pack-image-actions">
          <label className="btn-ghost pack-file">
            {imagem ? "Trocar imagem" : "Enviar imagem"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setRemoveImage(false);
                setSaved(false);
              }}
            />
          </label>
          {imagem && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setFile(null);
                setRemoveImage(true);
                setSaved(false);
              }}
            >
              Tirar imagem
            </button>
          )}
          <small className="pack-hint">Opcional. Usada no compartilhamento do link. JPG, PNG ou WebP, até 3 MB.</small>
        </div>
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="auction-form-actions">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : lot ? "Salvar alterações" : "Criar lote"}
        </button>
        {saved && <span className="auction-saved">Alterações salvas.</span>}
        {lot?.status === "rascunho" && (
          <button type="button" className="btn-ghost" onClick={excluir} disabled={pending}>
            {confirmDelete ? "Toque de novo para excluir" : "Excluir lote"}
          </button>
        )}
      </div>
    </form>
  );
}
