"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_COLLECTION_NAME } from "@/lib/brand";
import { getCatalog } from "@/lib/catalog";
import { forgetLocalCodes } from "@/lib/localBackup";
import AccountHeader from "./AccountHeader";

interface Option {
  albumId: string;
  slug: string;
  name: string;
  total: number;
  itemSingular: string;
  itemPlural: string;
  /** Capa do álbum (public/brand/albums); null = sem capa. */
  cover: string | null;
  /** Itens que a pessoa marcou nesta coleção. */
  marked: number;
  /** A coleção está à venda na loja da pessoa. */
  inShop: boolean;
  /** Nome que a pessoa deu, "" se tem sem nome, null se ainda não tem a coleção. */
  owned: string | null;
}

interface CollectionsPageProps {
  userId: string;
  email: string | null;
  shop: { href: string; active: boolean };
  /** Coleção que a pessoa tentou abrir sem ter (/colecao/<slug>). */
  highlight: string | null;
  nextPosition: number;
  options: Option[];
}

export default function CollectionsPage({ userId, email, shop, highlight, nextPosition, options }: CollectionsPageProps) {
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<Option | null>(null);
  const [apagando, setApagando] = useState(false);
  const [erroRemover, setErroRemover] = useState<string | null>(null);

  async function adicionar(o: Option) {
    setErro(null);
    setAdding(o.albumId);
    const { error } = await createClient()
      .from("user_albums")
      .upsert(
        { user_id: userId, album_id: o.albumId, position: nextPosition },
        { onConflict: "user_id,album_id", ignoreDuplicates: true }
      );
    if (error) {
      setAdding(null);
      return setErro("Não foi possível adicionar a coleção — tente de novo.");
    }
    router.push(`/colecao/${o.slug}`);
  }

  async function remover(o: Option) {
    setErroRemover(null);
    setApagando(true);
    const res = await fetch("/api/colecoes/remover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId: o.albumId }),
    }).catch(() => null);
    setApagando(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      return setErroRemover(data?.error ?? "Não foi possível remover a coleção — tente de novo.");
    }
    // limpa também a cópia local do navegador, para as marcações não voltarem
    forgetLocalCodes(userId, getCatalog(o.albumId).blocks.flatMap((b) => b.codes));
    setRemovendo(null);
    router.refresh();
  }

  // volta para de onde a pessoa veio; aberta direto (sem histórico), vai para a coleção
  function voltar() {
    if (window.history.length > 1) router.back();
    else router.push("/colecao");
  }

  return (
    <div className="app-shell">
      <AccountHeader title="Coleções" email={email} shop={shop} />

      <div className="admin-page">
        <section className="admin-section">
          <div className="collections-head">
            <button type="button" className="btn-ghost collections-back" onClick={voltar}>
              ← Voltar
            </button>
            <h2 className="admin-section-title">Escolha o que colecionar</h2>
          </div>
          <p className="modal-notice">
            Cada coleção tem seu próprio progresso, lista de repetidas e link público. Você pode acompanhar várias ao
            mesmo tempo e trocar entre elas pelo botão da coleção, no topo.
          </p>
          {erro && <div className="login-error">{erro}</div>}
          <div className="collections-grid">
            {options.map((o) => {
              const tem = o.owned !== null;
              return (
                <div
                  key={o.albumId}
                  className={`collection-option${tem ? " is-owned" : ""}${highlight === o.slug ? " is-highlight" : ""}`}
                >
                  <div className="collection-option-cover">
                    {o.cover ? <Image src={o.cover} alt="" width={480} height={640} unoptimized /> : <span>{o.name}</span>}
                    {tem && <em>Na sua conta</em>}
                  </div>
                  <div className="collection-option-info">
                    <strong>{o.name}</strong>
                    <span>
                      {o.total.toLocaleString("pt-BR")} {o.itemPlural}
                    </span>
                    {tem && <span>{o.owned || DEFAULT_COLLECTION_NAME}</span>}
                  </div>
                  {tem ? (
                    <>
                      <Link href={`/colecao/${o.slug}`} className="btn-ghost">
                        Abrir
                      </Link>
                      <button
                        type="button"
                        className="collection-option-remove"
                        onClick={() => {
                          setErroRemover(null);
                          setRemovendo(o);
                        }}
                      >
                        Remover coleção
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-primary" disabled={adding !== null} onClick={() => void adicionar(o)}>
                      {adding === o.albumId ? "Adicionando…" : "Adicionar"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {removendo && (
        <div
          className="modal-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label="Remover coleção"
          onClick={() => !apagando && setRemovendo(null)}
        >
          <div className="modal-card remove-collection-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Remover {removendo.name}?</span>
            </div>
            <div className="remove-collection-body">
              <p>
                {removendo.marked > 0 ? (
                  <>
                    Tod{f(removendo) ? "as as" : "os os"}{" "}
                    <strong>
                      {removendo.marked.toLocaleString("pt-BR")} {removendo.marked === 1 ? removendo.itemSingular : removendo.itemPlural}
                    </strong>{" "}
                    que você marcou nesta coleção, incluindo as repetidas, serão apagad{f(removendo) ? "as" : "os"}.
                  </>
                ) : (
                  <>Esta coleção sai da sua conta.</>
                )}{" "}
                O link público dela também deixa de funcionar.
              </p>
              {removendo.inShop && (
                <p>
                  Sua loja vende as repetidas desta coleção: sem elas, a loja fica <strong>sem itens à venda</strong>{" "}
                  nesta coleção.
                </p>
              )}
              <p className="remove-collection-warn">Esta ação não pode ser desfeita.</p>
              {erroRemover && <div className="login-error">{erroRemover}</div>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" disabled={apagando} onClick={() => setRemovendo(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-danger" disabled={apagando} onClick={() => void remover(removendo)}>
                {apagando ? "Removendo…" : "Remover coleção"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const f = (o: Option) => o.itemSingular === "figurinha";
