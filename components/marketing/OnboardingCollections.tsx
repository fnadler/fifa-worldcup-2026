"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NAME_MAX, cleanName } from "@/lib/brand";
import { createClient } from "@/lib/supabase/client";
import MarketingLogo from "./Logo";

// Escolha das coleções logo depois do cadastro. Uma ou mais; o nome vale para as escolhidas e pode ser
// trocado depois em Meu perfil.

interface Option {
  albumId: string;
  slug: string;
  name: string;
  total: number;
  itemPlural: string;
  cover: string | null;
  fallback: string | null;
}

interface Props {
  userId: string;
  firstName: string;
  /** Coleções que a conta já tem (ex: criadas pelo gatilho do banco) — já vêm marcadas. */
  owned: string[];
  options: Option[];
}

export default function OnboardingCollections({ userId, firstName, owned, options }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(owned));
  const [nome, setNome] = useState(firstName ? `Coleção de ${firstName}`.slice(0, NAME_MAX) : "");
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function comecar() {
    const escolhidas = options.filter((o) => selected.has(o.albumId));
    if (!escolhidas.length) return setErro("Escolha pelo menos uma coleção para começar.");
    const colecao = cleanName(nome);
    if (colecao.length < 2) return setErro("Dê um nome para a sua coleção (ex: Coleção do João).");

    setErro(null);
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("user_albums").upsert(
      escolhidas.map((o, i) => ({ user_id: userId, album_id: o.albumId, position: i, collection_name: colecao })),
      { onConflict: "user_id,album_id" }
    );
    if (error) {
      setSaving(false);
      return setErro("Não foi possível salvar — tente de novo.");
    }
    await supabase.auth.updateUser({ data: { onboarding: "done", collection_name: colecao } });
    router.push(`/colecao/${escolhidas[0].slug}`);
  }

  return (
    <div className="mk-onb">
      <header className="mk-hero mk-onb-top">
        <MarketingLogo />
      </header>
      <main className="mk-onb-main mk-container">
        <div className="mk-section-head">
          <span className="mk-kicker">{firstName ? `Boas-vindas, ${firstName}!` : "Boas-vindas!"}</span>
          <h1 className="mk-h2">O que você vai colecionar?</h1>
          <p>Escolha uma ou mais coleções. Cada uma tem o seu progresso, e você pode adicionar outras depois.</p>
        </div>

        <div className="mk-onb-grid">
          {options.map((o) => {
            const on = selected.has(o.albumId);
            const img = o.cover ?? o.fallback;
            return (
              <button
                key={o.albumId}
                type="button"
                className={`mk-onb-card${on ? " on" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(o.albumId)}
              >
                <span className="mk-onb-check" aria-hidden="true">
                  ✓
                </span>
                <span className={`mk-onb-cover${o.cover ? "" : " is-fallback"}`}>
                  {img && <Image src={img} alt="" width={480} height={640} unoptimized />}
                </span>
                <strong>{o.name}</strong>
                <small>
                  {o.total.toLocaleString("pt-BR")} {o.itemPlural}
                </small>
              </button>
            );
          })}
        </div>

        <div className="mk-onb-foot">
          <label className="mk-onb-name">
            <span>Nome da sua coleção</span>
            <input
              className="login-input"
              value={nome}
              maxLength={NAME_MAX}
              placeholder="Ex: Coleção do João"
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <button type="button" className="mk-btn mk-btn-yellow" onClick={comecar} disabled={saving}>
            {saving ? "Preparando…" : selected.size > 1 ? `Começar ${selected.size} coleções` : "Começar minha coleção"}
          </button>
        </div>
        {erro && <div className="login-error">{erro}</div>}
      </main>
    </div>
  );
}
