"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { legendName, legendTierOf } from "@/lib/packs";
import { stickerImage } from "@/lib/stickerImages";
import Envelope from "./Envelope";

// Abertura de um pacote (protótipo aprovado): o envelope flutua; arrastar no picote (ou tocar) rasga a
// faixa de cima; as figurinhas sobem, o envelope cai; cada toque mostra uma das 7; a Legend vem por
// último, com verso dourado, tremor, brilho e confete. A Legend é sorteada no servidor quando a pessoa
// começa a abrir.

export interface PackContent {
  legend: string;
  commons: string[];
}

const TIER_COLOR: Record<string, string> = { LIL: "#b88cff", BRO: "#d08a4f", PRA: "#d4dbe2", OUR: "#ffcf4d" };
const pad = (n: number) => String(n).padStart(2, "0");

function zigzag(top: boolean): string {
  const pts: string[] = [];
  for (let x = 0; x <= 100; x += 4) pts.push(`${x}% ${x % 8 === 0 ? 11.2 : 12.6}%`);
  return top ? `polygon(0 0, 100% 0, ${[...pts].reverse().join(", ")})` : `polygon(${pts.join(", ")}, 100% 100%, 0 100%)`;
}

function confetti(color: string) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.className = "po-confetti";
  document.body.appendChild(c);
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  const ctx = c.getContext("2d");
  if (!ctx) return c.remove();
  ctx.scale(dpr, dpr);
  const colors = [color, "#fdca04", "#029836", "#ffffff", color];
  const parts = Array.from({ length: 150 }, () => ({
    x: innerWidth / 2,
    y: innerHeight * 0.42,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 13 - 3,
    s: Math.random() * 7 + 4,
    r: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  const frame = (now: number) => {
    const el = now - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - el / 2200);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (el < 2200) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

const buzz = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    // sem vibração
  }
};

type Phase = "sealed" | "shaking" | "tearing" | "rising" | "dropping" | "reveal" | "charging" | "revealed";

export default function PackOpening({
  token,
  number,
  seller,
  logoUrl,
  remaining,
  onOpened,
  onNext,
  onSummary,
  onClose,
}: {
  token: string;
  number: number;
  seller: string;
  logoUrl: string | null;
  /** Pacotes fechados depois deste. */
  remaining: number;
  onOpened: (c: PackContent) => void;
  onNext: () => void;
  onSummary: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("sealed");
  const [tear, setTear] = useState(0);
  const [content, setContent] = useState<PackContent | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(0); // quantas cartas já viraram (as primeiras `flipped`)
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; w: number; moved: boolean } | null>(null);
  const started = useRef(false);
  const busy = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // a página de trás não rola enquanto o pacote está aberto na tela
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduced.current ? 0 : ms));

  // O conteúdo é buscado assim que a tela de abertura aparece (a pessoa já escolheu abrir este pacote) e as
  // fotos são carregadas e decodificadas antes de as figurinhas subirem — assim a animação não trava.
  const load = useRef<Promise<{ ok: true } | { ok: false; error: string }> | null>(null);

  function fetchContent() {
    if (load.current) return load.current;
    load.current = (async () => {
      try {
        const r = await fetch(`/api/pacote/${token}/abrir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number }),
        });
        const data = (await r.json()) as { legend?: string; commons?: string[]; error?: string };
        if (!r.ok || !data.legend || !data.commons) return { ok: false as const, error: data.error ?? "Não foi possível abrir o pacote — tente de novo." };
        const c = { legend: data.legend, commons: data.commons };
        const urls = [...c.commons, c.legend].map((code) => stickerImage(code, "large")).filter((u): u is string => !!u);
        const decoded = Promise.all(
          urls.map((u) => {
            const img = new Image();
            img.src = u;
            return img.decode().catch(() => undefined);
          })
        );
        await Promise.race([decoded, new Promise((r) => setTimeout(r, 2500))]);
        setContent(c);
        onOpened(c);
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "Sem conexão — verifique sua internet e tente de novo." };
      }
    })();
    return load.current;
  }

  useEffect(() => {
    void fetchContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(fromTap: boolean) {
    if (started.current) return;
    started.current = true;
    setError(null);
    const req = fetchContent();

    if (fromTap) {
      setPhase("shaking");
      buzz(20);
      await wait(420);
      for (let t = 0; t <= 1.001; t += 0.2) {
        setTear(t);
        await wait(30);
      }
    }
    const res = await req;
    if (!res.ok) {
      setError(res.error);
      setTear(0);
      setPhase("sealed");
      started.current = false;
      load.current = null;
      return;
    }
    buzz(30);
    setPhase("tearing");
    await wait(350);
    setPhase("rising");
    await wait(650);
    setPhase("dropping");
    await wait(950);
    setPhase("reveal");
    setFlipped(1);
  }

  async function next() {
    if (busy.current || !content) return;
    busy.current = true;
    if (idx < 7) {
      const n = idx + 1;
      setIdx(n);
      await wait(220);
      if (n < 7) setFlipped(n + 1);
      else buzz([20, 60, 20]);
    } else if (phase === "reveal") {
      setPhase("charging");
      buzz([40, 80, 40, 80, 120]);
      await wait(900);
      setFlipped(8);
      setPhase("revealed");
      await wait(300);
      confetti(TIER_COLOR[legendTierOf(content.legend)?.id ?? "OUR"] ?? "#fdca04");
    }
    busy.current = false;
  }

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (phase !== "sealed") return;
    drag.current = { x: e.clientX, w: e.currentTarget.getBoundingClientRect().width * 0.66, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || phase !== "sealed") return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
    if (d.moved) setTear(Math.max(0, Math.min(1, dx / (d.w * 0.75))));
  }
  function up(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (phase === "sealed" && d) {
      const dx = e.clientX - d.x;
      if (!d.moved) void start(true);
      else if (dx > 60) void start(false);
      else setTear(0);
      return;
    }
    if (phase === "reveal") void next();
  }

  const tier = content ? legendTierOf(content.legend) : undefined;
  const cards = content ? [...content.commons.map((c) => ({ code: c, legend: false })), { code: content.legend, legend: true }] : [];
  const opened = phase !== "sealed" && phase !== "shaking";
  const hint =
    phase === "sealed"
      ? "Arraste no picote para abrir"
      : phase === "reveal" && idx < 7
        ? `${idx + 1} de 7`
        : phase === "reveal"
          ? "A última é a sua Legend"
          : "";
  const sub =
    phase === "sealed"
      ? "ou toque no pacote"
      : phase !== "reveal"
        ? ""
        : idx < 6
          ? "Toque para a próxima"
          : idx === 6
            ? "Toque para ver a Legend"
            : "Toque para revelar";

  return (
    <div className="po" role="dialog" aria-modal="true" aria-label={`Abrindo o pacote nº ${pad(number)}`}>
      <div className="po-top">
        <span>Pacote nº {pad(number)}</span>
        {(phase === "sealed" || phase === "revealed") && (
          <button className="po-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        )}
      </div>

      <div className="po-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <div className={`po-pack${phase === "sealed" ? " is-floating" : ""}${phase === "shaking" ? " is-shaking" : ""}`}>
          <div className={`po-part po-body${phase === "dropping" || phase === "reveal" || phase === "charging" || phase === "revealed" ? " is-dropped" : ""}`} style={{ clipPath: zigzag(false) }}>
            <Envelope seller={seller} logoUrl={logoUrl} />
          </div>
          <div
            className={`po-part po-tear${opened ? " is-gone" : ""}`}
            style={{ clipPath: zigzag(true), transform: opened ? undefined : `rotate(${-tear * 9}deg) translate(${tear * 6}px, ${-tear * 10}px)` }}
          >
            <Envelope seller={seller} logoUrl={logoUrl} />
          </div>
          {phase === "sealed" && <div className="po-tear-hint" />}
        </div>

        {content && (
          <div className={`po-stack${phase === "rising" ? " is-rising" : ""}${["dropping", "reveal", "charging", "revealed"].includes(phase) ? " is-center" : ""}`}>
            {cards.map((c, k) => {
              const gone = k < idx;
              const top = k === idx;
              const isFlipped = k < flipped;
              const style = gone
                ? { transform: "translate(-120%, 30%) rotate(-18deg)", zIndex: 20 - k }
                : top
                  ? { zIndex: 20 - k, ...(phase === "revealed" && c.legend ? { transform: "scale(1.08)" } : {}) }
                  : { transform: `translate(${(7 - k) * 1.2}px, ${(7 - k) * 1.2}px) rotate(${((k * 37) % 5) - 2}deg)`, zIndex: 20 - k };
              return (
                <div
                  key={`${c.code}-${k}`}
                  className={`po-card${c.legend ? " is-legend" : ""}${gone ? " is-gone" : ""}${isFlipped ? " is-flipped" : ""}${c.legend && phase === "charging" ? " is-charging" : ""}${c.legend && phase === "revealed" ? " is-revealed" : ""}`}
                  style={style}
                >
                  <div className="po-inner">
                    <div className="po-face po-back">
                      {c.legend ? (
                        <span>
                          LEGEND<small>TOQUE PARA REVELAR</small>
                        </span>
                      ) : (
                        <span>
                          GN<small>COLECIONA</small>
                        </span>
                      )}
                    </div>
                    <div className="po-face po-front">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={stickerImage(c.code, "large") ?? ""} alt={c.legend ? `${legendName(c.code)} ${tier?.name ?? ""}` : `Figurinha ${c.code}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {content && (
          <div className={`po-banner${phase === "revealed" ? " is-shown" : ""}`}>
            <span>LEGEND {tier?.name.toUpperCase()}</span>
            <b>{legendName(content.legend)}</b>
          </div>
        )}
      </div>

      <div className="po-hint">
        {error ? (
          <span className="po-error">{error}</span>
        ) : phase === "revealed" ? (
          <div className="po-actions">
            {remaining > 0 ? (
              <>
                <button className="lotp-btn lotp-btn-gold" onClick={onNext}>
                  Abrir o próximo pacote
                </button>
                <small>{remaining === 1 ? "Falta 1 pacote" : `Faltam ${remaining} pacotes`}</small>
              </>
            ) : (
              <button className="lotp-btn lotp-btn-gold" onClick={onSummary}>
                Ver tudo o que veio
              </button>
            )}
          </div>
        ) : (
          <>
            {hint || " "}
            {sub && <small>{sub}</small>}
          </>
        )}
      </div>

      <div className="po-tray">
        {Array.from({ length: 8 }, (_, k) => {
          const shown = content && (k < idx || (k === 7 && phase === "revealed"));
          return (
            <div key={k} className={`po-slot${k === 7 ? " is-leg" : ""}`}>
              {shown && content && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stickerImage(k === 7 ? content.legend : content.commons[k], "thumb") ?? ""} alt="" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
