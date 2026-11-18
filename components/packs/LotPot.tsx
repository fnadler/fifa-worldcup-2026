"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addLegends, removeLegends } from "@/app/vendas/pacotes/actions";
import { LEGEND_TIERS, type LegendCount } from "@/lib/packs";
import { stickerImage } from "@/lib/stickerImages";

// O pote do lote: as Legends que vão nos pacotes, uma unidade por pacote. Escolha à mão (+/−) ou por
// cor ("+1 de cada"). Cada unidade colocada sai das repetidas da loja; tirar devolve.

export default function LotPot({
  lotId,
  editable,
  pot,
  available,
}: {
  lotId: string;
  editable: boolean;
  pot: LegendCount;
  available: LegendCount;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [onlyMine, setOnlyMine] = useState(!editable);

  const total = Object.values(pot).reduce((a, b) => a + b, 0);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  return (
    <section className="admin-section">
      <div className="collections-head">
        <h2 className="admin-section-title">Pote de Legends</h2>
        <span className="pack-pot-total">
          {total} {total === 1 ? "Legend" : "Legends"} = {total} {total === 1 ? "pacote" : "pacotes"}
        </span>
      </div>
      <p className="adm-updated">
        {editable
          ? "Escolha as Legends do lote. Cada unidade no pote vira um pacote e sai das suas repetidas; ao tirar, ela volta."
          : "O pote está travado porque o lote não está em rascunho."}
      </p>
      <label className="pack-check">
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
        Mostrar só as Legends que estão no pote
      </label>
      {error && <div className="login-error">{error}</div>}

      {LEGEND_TIERS.map((t) => {
        const noPote = t.codes.reduce((s, c) => s + (pot[c] ?? 0), 0);
        const livres = t.codes.filter((c) => (available[c] ?? 0) > 0);
        const visiveis = t.codes.filter((c) => !onlyMine || (pot[c] ?? 0) > 0);
        if (onlyMine && visiveis.length === 0) return null;
        return (
          <div key={t.id} className={`pack-tier is-${t.id.toLowerCase()}`}>
            <div className="pack-tier-head">
              <h3>
                {t.name} <span>{noPote} no pote</span>
              </h3>
              {editable && (
                <div className="pack-tier-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={pending || livres.length === 0}
                    onClick={() => run(() => addLegends(lotId, livres))}
                    title="Coloca 1 unidade de cada Legend desta cor que tenha repetida livre"
                  >
                    +1 de cada ({livres.length})
                  </button>
                  {noPote > 0 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          for (const c of t.codes) {
                            if (!pot[c]) continue;
                            const r = await removeLegends(lotId, c, pot[c]);
                            if (!r.ok) return r;
                          }
                          return { ok: true as const };
                        })
                      }
                    >
                      Tirar todas
                    </button>
                  )}
                </div>
              )}
            </div>
            <ul className="pack-legends">
              {visiveis.map((code) => {
                const i = t.codes.indexOf(code);
                const n = pot[code] ?? 0;
                const free = available[code] ?? 0;
                const img = stickerImage(code, "thumb");
                return (
                  <li key={code} className={n > 0 ? "is-in" : ""}>
                    <div className="pack-legend-photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img && <img src={img} alt="" loading="lazy" />}
                      {n > 0 && <span className="pack-legend-qty">×{n}</span>}
                    </div>
                    <span className="pack-legend-name">{t.names[i]}</span>
                    <span className="pack-legend-free">{free > 0 ? `${free} ${free === 1 ? "livre" : "livres"}` : "sem repetida livre"}</span>
                    {editable && (
                      <div className="pack-stepper">
                        <button type="button" aria-label={`Tirar ${t.names[i]}`} disabled={pending || n === 0} onClick={() => run(() => removeLegends(lotId, code, 1))}>
                          −
                        </button>
                        <output>{n}</output>
                        <button type="button" aria-label={`Colocar ${t.names[i]}`} disabled={pending || free === 0} onClick={() => run(() => addLegends(lotId, [code]))}>
                          +
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
