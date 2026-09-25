"use client";

import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { BLOCKS, anchorId, blockTag, cellText, codigoBase, hasNamedStickers, stickerName } from "@/lib/album";
import { matchesSticker } from "@/lib/derive";
import { createClient } from "@/lib/supabase/client";
import { GROUP_LABELS, centsToInput, formatBRL, parseBRL, priceFor, type GroupPrices } from "@/lib/shop";
import type { BlockType, Qtd, TipoFiltro } from "@/lib/types";

interface AdminPricesProps {
  userId: string;
  group: GroupPrices;
  setGroup: Dispatch<SetStateAction<GroupPrices>>;
  individual: Record<string, number>;
  setIndividual: Dispatch<SetStateAction<Record<string, number>>>;
  available: Qtd;
  onToast: (msg: string) => void;
}

type Pincel = "set" | "clear";

const TIPOS: { value: TipoFiltro; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "TEAM", label: "Seleções" },
  { value: "FWC", label: "FWC" },
  { value: "CC", label: "Coca-Cola" },
  { value: "LEG", label: "Legends" },
];

const GROUP_ORDER: BlockType[] = ["FWC", "TEAM", "CC", "LEG"];

export default function AdminPrices({
  userId,
  group,
  setGroup,
  individual,
  setIndividual,
  available,
  onToast,
}: AdminPricesProps) {
  const [groupInputs, setGroupInputs] = useState<Record<BlockType, string>>({
    FWC: centsToInput(group.FWC),
    TEAM: centsToInput(group.TEAM),
    CC: centsToInput(group.CC),
    LEG: centsToInput(group.LEG),
  });
  const [savingGroup, setSavingGroup] = useState(false);

  const [pincel, setPincel] = useState<Pincel>("set");
  const [pincelInput, setPincelInput] = useState("");
  const [tipo, setTipo] = useState<TipoFiltro>("ALL");
  const [soEstoque, setSoEstoque] = useState(true);
  const [busca, setBusca] = useState("");

  const pricing = useMemo(() => ({ group, individual }), [group, individual]);

  async function salvarGrupos(e: FormEvent) {
    e.preventDefault();
    const parsed = {} as GroupPrices;
    for (const t of GROUP_ORDER) {
      const v = parseBRL(groupInputs[t]);
      if (Number.isNaN(v)) return onToast(`Preço inválido para ${GROUP_LABELS[t]}. Use o formato 2,50.`);
      parsed[t] = v;
    }
    setSavingGroup(true);
    const { error } = await createClient()
      .from("shops")
      .update({
        price_fwc_cents: parsed.FWC,
        price_team_cents: parsed.TEAM,
        price_cc_cents: parsed.CC,
        price_leg_cents: parsed.LEG,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setSavingGroup(false);
    if (error) return onToast("Não foi possível salvar os preços — tente de novo.");
    setGroup(parsed);
    onToast("Preços por grupo salvos!");
  }

  async function aplicar(codes: string[]) {
    const supabase = createClient();
    const anterior = individual;

    if (pincel === "clear") {
      const alvo = codes.filter((c) => individual[c] !== undefined);
      if (!alvo.length) return;
      setIndividual((prev) => {
        const next = { ...prev };
        alvo.forEach((c) => delete next[c]);
        return next;
      });
      const { error } = await supabase.from("sticker_prices").delete().eq("user_id", userId).in("code", alvo);
      if (error) {
        setIndividual(anterior);
        onToast("Não foi possível remover o preço — tente de novo.");
      }
      return;
    }

    const cents = parseBRL(pincelInput);
    if (cents === null || Number.isNaN(cents)) {
      onToast("Digite o preço a aplicar (ex: 3,00) antes de clicar nas figurinhas.");
      return;
    }
    setIndividual((prev) => {
      const next = { ...prev };
      codes.forEach((c) => (next[c] = cents));
      return next;
    });
    const { error } = await supabase
      .from("sticker_prices")
      .upsert(
        codes.map((code) => ({ user_id: userId, code, price_cents: cents })),
        { onConflict: "user_id,code" }
      );
    if (error) {
      setIndividual(anterior);
      onToast("Não foi possível salvar o preço — tente de novo.");
    }
  }

  const visibleBlocks = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return BLOCKS.flatMap((b) => {
      if (tipo !== "ALL" && tipo !== b.tipo) return [];
      const matchBloco =
        !buscaLower || b.nome.toLowerCase().includes(buscaLower) || b.id.toLowerCase().includes(buscaLower);
      const codes = b.codes.filter((code) => {
        if (soEstoque && !(available[code] > 0)) return false;
        if (buscaLower && !matchBloco && !matchesSticker(code, buscaLower)) return false;
        return true;
      });
      return codes.length ? [{ block: b, codes }] : [];
    });
  }, [busca, tipo, soEstoque, available]);

  const qtdIndividual = Object.keys(individual).length;

  return (
    <div className="admin-page">
      <form className="admin-section" onSubmit={salvarGrupos}>
        <h2 className="admin-section-title">Preço por grupo</h2>
        <p className="modal-notice">
          Vale para todas as figurinhas do grupo que não tenham preço individual. Deixe em branco para não vender o
          grupo (a não ser as figurinhas com preço individual).
        </p>
        <div className="form-row">
          {GROUP_ORDER.map((t) => (
            <label key={t} className="form-label">
              {GROUP_LABELS[t]} (R$)
              <input
                className="login-input"
                inputMode="decimal"
                placeholder="sem preço"
                value={groupInputs[t]}
                onChange={(e) => setGroupInputs((g) => ({ ...g, [t]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="submit" className="btn-restore" disabled={savingGroup}>
            {savingGroup ? "Salvando…" : "Salvar preços por grupo"}
          </button>
        </div>
      </form>

      <section className="admin-section">
        <h2 className="admin-section-title">Preço individual</h2>
        <p className="modal-notice">
          Escolha o pincel e clique nas figurinhas (ou em “aplicar ao bloco”). O preço individual sobrepõe o do grupo.
          {qtdIndividual > 0 && ` ${qtdIndividual} figurinha${qtdIndividual === 1 ? "" : "s"} com preço individual.`}
        </p>

        <div className="controls-row">
          <div className="segmented">
            <button
              type="button"
              className={`chip ${pincel === "set" ? "active" : ""}`}
              onClick={() => setPincel("set")}
            >
              Definir preço
            </button>
            <button
              type="button"
              className={`chip ${pincel === "clear" ? "active" : ""}`}
              onClick={() => setPincel("clear")}
            >
              Voltar ao do grupo
            </button>
          </div>
          {pincel === "set" && (
            <input
              className="login-input price-brush-input"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={pincelInput}
              onChange={(e) => setPincelInput(e.target.value)}
            />
          )}
        </div>

        <div className="controls-row">
          <input
            type="search"
            placeholder="Buscar seleção ou código (ex: BRA9)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="search-input"
          />
          <div className="segmented">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`chip ${tipo === t.value ? "active" : ""}`}
                onClick={() => setTipo(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="segmented">
            <button type="button" className={`chip ${soEstoque ? "active" : ""}`} onClick={() => setSoEstoque(true)}>
              Com estoque
            </button>
            <button type="button" className={`chip ${!soEstoque ? "active" : ""}`} onClick={() => setSoEstoque(false)}>
              Todas
            </button>
          </div>
        </div>

        <div className="legend-bar admin-legend">
          <span className="legend-item">
            <i className="legend-swatch swatch-dup" />
            preço individual
          </span>
          <span className="legend-item">
            <i className="legend-swatch swatch-avail" />
            preço do grupo
          </span>
          <span className="legend-item">
            <i className="legend-swatch swatch-empty" />
            sem preço
          </span>
        </div>
      </section>

      <div className="board admin-board">
        {visibleBlocks.map(({ block, codes }) => (
          <div key={block.id} id={anchorId(block)} className="block-card">
            <div className="block-header">
              <span className={`block-tag ${block.tipo !== "TEAM" ? "block-tag-special" : ""}`}>{blockTag(block)}</span>
              <span className="block-name">{block.nome}</span>
              <span className="block-code-range">{codigoBase(block)}</span>
              <div className="block-header-spacer" />
              <button type="button" className="btn-ghost btn-small" onClick={() => void aplicar(codes)}>
                {pincel === "set" ? "Aplicar ao bloco" : "Limpar bloco"}
              </button>
            </div>
            <div className={`cell-grid shop-grid ${hasNamedStickers(block) ? "cell-grid-named" : ""}`}>
              {codes.map((code) => {
                const preco = priceFor(code, pricing);
                const isIndividual = individual[code] !== undefined;
                const estoque = available[code] ?? 0;
                const state = isIndividual ? "shop-cell-in-cart" : preco !== null ? "shop-cell-on" : "shop-cell-off";
                const title = `${code} — ${preco === null ? "sem preço" : formatBRL(preco)}${
                  isIndividual ? " (individual)" : preco !== null ? " (grupo)" : ""
                } · ${estoque} em estoque`;
                return (
                  <button
                    key={code}
                    type="button"
                    title={title}
                    aria-label={title}
                    className={`shop-cell ${state} shop-cell-editable`}
                    onClick={() => void aplicar([code])}
                  >
                    <span className={stickerName(code) ? "sticker-name" : "sticker-num"}>{cellText(code)}</span>
                    <span className="shop-cell-price">{preco === null ? "—" : formatBRL(preco)}</span>
                    <span className="shop-cell-stock">{estoque} disp.</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {visibleBlocks.length === 0 && (
          <div className="empty-message">
            {soEstoque ? "Nenhuma repetida em estoque com esses filtros." : "Nenhuma figurinha com esses filtros."}
          </div>
        )}
      </div>
    </div>
  );
}
