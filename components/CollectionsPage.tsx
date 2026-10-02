"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_COLLECTION_NAME } from "@/lib/brand";
import AccountHeader from "./AccountHeader";

interface Option {
  albumId: string;
  slug: string;
  name: string;
  total: number;
  itemPlural: string;
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

  return (
    <div className="app-shell">
      <AccountHeader title="Coleções" email={email} shop={shop} />

      <div className="admin-page">
        <section className="admin-section">
          <h2 className="admin-section-title">Escolha o que colecionar</h2>
          <p className="modal-notice">
            Cada coleção tem seu próprio progresso, lista de repetidas e link público. Você pode acompanhar várias ao
            mesmo tempo e trocar entre elas pelo nome acima do título.
          </p>
          {erro && <div className="login-error">{erro}</div>}
          <div className="collections-grid">
            {options.map((o) => (
              <div key={o.albumId} className={`collection-option ${highlight === o.slug ? "is-highlight" : ""}`}>
                <div className="collection-option-info">
                  <strong>{o.name}</strong>
                  <span>
                    {o.total} {o.itemPlural}
                    {o.owned !== null && <> · {o.owned || DEFAULT_COLLECTION_NAME}</>}
                  </span>
                </div>
                {o.owned !== null ? (
                  <Link href={`/colecao/${o.slug}`} className="btn-ghost">
                    Abrir
                  </Link>
                ) : (
                  <button type="button" className="btn-primary" disabled={adding !== null} onClick={() => void adicionar(o)}>
                    {adding === o.albumId ? "Adicionando…" : "Adicionar"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
