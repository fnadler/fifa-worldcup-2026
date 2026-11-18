"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { legendName, legendTierOf } from "@/lib/packs";
import { itemOrder } from "@/lib/shop";
import { stickerImage } from "@/lib/stickerImages";
import type { PackContent } from "./PackOpening";

// O que veio num pacote: a Legend grande (inclina com o dedo/mouse) e as 7 figurinhas.

const TIER_BG: Record<string, string> = {
  LIL: "linear-gradient(160deg,#e6d6ff,#b88cff 45%,#7b4fd1)",
  BRO: "linear-gradient(160deg,#ffd9b3,#d08a4f 45%,#7d4a20)",
  PRA: "linear-gradient(160deg,#ffffff,#d4dbe2 40%,#8a96a3)",
  OUR: "linear-gradient(160deg,#fff6cf,#ffcf4d 40%,#b8860b)",
};
const pad = (n: number) => String(n).padStart(2, "0");

export default function PackResult({
  number,
  total,
  content,
  remaining,
  onNext,
  onBack,
}: {
  number: number;
  total: number;
  content: PackContent;
  remaining: number;
  onNext: () => void;
  onBack: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const tier = legendTierOf(content.legend);

  function tilt(e: ReactPointerEvent<HTMLDivElement>) {
    const el = card.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(px - 0.5) * 18}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 14}deg`);
    el.style.setProperty("--holo", `${px * 100}%`);
  }
  function reset() {
    card.current?.style.setProperty("--ry", "0deg");
    card.current?.style.setProperty("--rx", "0deg");
  }

  return (
    <div className="po-result">
      <div className="po-result-head">
        <span className="po-chip" style={{ background: TIER_BG[tier?.id ?? "OUR"] }}>
          Legend {tier?.name}
        </span>
        <h2>{legendName(content.legend)}</h2>
        <p>
          Pacote nº {pad(number)} · {total > 1 ? `${total} pacotes no pedido · ` : ""}7 figurinhas + 1 Legend
        </p>
      </div>
      <div className="po-result-legend" ref={card} onPointerMove={tilt} onPointerLeave={reset}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stickerImage(content.legend, "large") ?? ""} alt={`${legendName(content.legend)} ${tier?.name ?? ""}`} />
      </div>
      <div className="po-result-commons">
        {[...content.commons]
          .sort((a, b) => itemOrder(a) - itemOrder(b))
          .map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c} src={stickerImage(c, "thumb") ?? ""} alt={`Figurinha ${c}`} />
          ))}
      </div>
      <div className="po-result-actions">
        {remaining > 0 && (
          <button className="lotp-btn lotp-btn-gold" onClick={onNext}>
            Abrir o próximo pacote
          </button>
        )}
        <button className={`lotp-btn ${remaining > 0 ? "lotp-btn-ghost" : "lotp-btn-gold"}`} onClick={onBack}>
          Voltar aos pacotes
        </button>
      </div>
      <p className="po-result-note">
        {remaining > 0 ? `${remaining === 1 ? "Falta 1 pacote" : `Faltam ${remaining} pacotes`} para abrir. ` : ""}A loja separa estas 8 figurinhas e envia
        para o seu endereço.
      </p>
    </div>
  );
}
