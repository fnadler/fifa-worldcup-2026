"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NAME_MAX, cleanName } from "@/lib/brand";
import { ehCopa2026, type Intencao } from "@/lib/intencao";
import { createClient } from "@/lib/supabase/client";
import MarketingLogo from "./Logo";

// Escolha das coleções logo depois do cadastro. Uma ou mais; o nome vale para as escolhidas e pode ser
// trocado depois em Meu perfil. Duas abordagens, pela intenção do cadastro:
//   colecionar: "O que você vai colecionar?" → abre a coleção;
//   vender:     "De quais coleções você quer vender?" → abre a coleção com o guia da loja (?guia=loja).
// Primeiro só as coleções da Copa 2026; as outras ficam em "Ver mais coleções".

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
  modo: Intencao;
  userId: string;
  firstName: string;
  /** Coleções que a conta já tem (ex: criadas pelo gatilho do banco) — já vêm marcadas. */
  owned: string[];
  options: Option[];
}

const TEXTO: Record<Intencao, { titulo: string; sub: string; maisSub: string; botao: (n: number) => string }> = {
  colecionar: {
    titulo: "O que você vai colecionar?",
    sub: "Escolha uma ou mais coleções. Cada uma tem o seu progresso, e você pode adicionar outras depois. É grátis.",
    maisSub: "Álbuns das Copas de 1990 a 2022 e outras coleções.",
    botao: (n) => (n > 1 ? `Começar ${n} coleções` : "Começar minha coleção"),
  },
  vender: {
    titulo: "De quais coleções você quer vender as repetidas?",
    sub: "Escolha uma ou mais. Em seguida você marca o que tem, e o que passar de 1 unidade vira estoque da sua loja.",
    maisSub: "Também dá para vender repetidas dos álbuns das Copas de 1990 a 2022.",
    botao: (n) => (n > 1 ? `Montar minha loja com ${n} coleções` : "Montar minha loja"),
  },
};

export default function OnboardingCollections({ modo, userId, firstName, owned, options }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(owned));
  const [nome, setNome] = useState(firstName ? `Coleção de ${firstName}`.slice(0, NAME_MAX) : "");
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const copa = options.filter((o) => ehCopa2026(o.albumId));
  const outras = options.filter((o) => !ehCopa2026(o.albumId));
  // Quem já tem uma coleção de fora da Copa 2026 vê todas abertas (senão ela ficaria escondida, marcada).
  const [verMais, setVerMais] = useState(() => owned.some((id) => !ehCopa2026(id)));
  const router = useRouter();
  const t = TEXTO[modo];

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
    if (!escolhidas.length) return setErro(modo === "vender" ? "Escolha pelo menos uma coleção para vender." : "Escolha pelo menos uma coleção para começar.");
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
    router.push(`/colecao/${escolhidas[0].slug}${modo === "vender" ? "?guia=loja" : ""}`);
  }

  const grade = (lista: Option[]) => (
    <div className="mk-onb-grid">
      {lista.map((o) => {
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
  );

  return (
    <div className="mk-onb">
      <header className="mk-hero mk-onb-top">
        <MarketingLogo />
      </header>
      <main className="mk-onb-main mk-container">
        <div className="mk-section-head">
          <span className="mk-kicker">{firstName ? `Boas-vindas, ${firstName}!` : "Boas-vindas!"}</span>
          <h1 className="mk-h2">{t.titulo}</h1>
          <p>{t.sub}</p>
        </div>

        {grade(copa.length ? copa : outras)}

        {copa.length > 0 && outras.length > 0 && (
          <section className="mk-onb-mais" aria-label="Outras coleções">
            {verMais ? (
              <>
                <div className="mk-onb-mais-head">
                  <h2>Outras coleções</h2>
                  <p>{t.maisSub}</p>
                </div>
                {grade(outras)}
              </>
            ) : (
              <button type="button" className="mk-btn mk-btn-ghost-green mk-onb-mais-btn" onClick={() => setVerMais(true)}>
                Ver mais coleções ({outras.length})
              </button>
            )}
          </section>
        )}

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
            {saving ? "Preparando…" : t.botao(selected.size)}
          </button>
        </div>
        {erro && <div className="login-error">{erro}</div>}
      </main>
    </div>
  );
}
