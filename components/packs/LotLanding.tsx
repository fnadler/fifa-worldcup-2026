"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatAuctionDate } from "@/lib/auctions";
import { LEGEND_TIERS, legendName, legendTierOf } from "@/lib/packs";
import type { PublicLot, PublicPack } from "@/lib/packsPublic";
import { formatBRL } from "@/lib/shop";
import { stickerImage } from "@/lib/stickerImages";
import Envelope from "./Envelope";
import PackCheckout from "./PackCheckout";

// Página promocional do lote: topo com envelope, abas Pacotes / Legends no pote, como funciona, perguntas
// e a barra de compra fixa. A escolha dos números leva ao checkout (PackCheckout).

const TIER_COLOR: Record<string, string> = { LIL: "#b88cff", BRO: "#d08a4f", PRA: "#d4dbe2", OUR: "#ffcf4d" };
const pad = (n: number) => String(n).padStart(2, "0");
const img = (code: string, size: "thumb" | "large" = "thumb") => stickerImage(code, size) ?? "";

function agoText(iso: string, now: number): string {
  const min = Math.max(1, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export default function LotLanding({ data }: { data: PublicLot }) {
  const router = useRouter();
  const { shop, lot, packs, pot, salesOpen, isOwner } = data;
  const [tab, setTab] = useState<"packs" | "pot">("packs");
  const [filter, setFilter] = useState<"all" | "free" | "open">("all");
  const [tier, setTier] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pick, setPick] = useState(3);
  const [opened, setOpened] = useState<PublicPack | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // A grade muda com os pedidos dos outros: atualiza a cada 40s com a aba visível.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible" && !checkout) {
        router.refresh();
        setNow(Date.now());
      }
    }, 40_000);
    return () => window.clearInterval(t);
  }, [router, checkout]);

  // Números que deixaram de estar livres saem da seleção.
  const freeSet = useMemo(() => new Set(packs.filter((p) => p.state === "free").map((p) => p.n)), [packs]);
  useEffect(() => {
    queueMicrotask(() =>
      setSelected((s) => {
        const next = new Set([...s].filter((n) => freeSet.has(n)));
        return next.size === s.size ? s : next;
      })
    );
  }, [freeSet]);

  const counts = useMemo(() => {
    const c = { free: 0, res: 0, sold: 0, open: 0 };
    packs.forEach((p) => c[p.state]++);
    return c;
  }, [packs]);
  const potLeft = Object.values(pot.left).reduce((a, b) => a + b, 0);
  const potAll = Object.values(pot.all).reduce((a, b) => a + b, 0);
  const feed = useMemo(
    () => packs.filter((p) => p.state === "open" && p.openedAt).sort((a, b) => Date.parse(b.openedAt!) - Date.parse(a.openedAt!)).slice(0, 10),
    [packs]
  );
  const startsLater = lot.status === "ativo" && lot.startsAt && Date.parse(lot.startsAt) > now;
  const canBuy = salesOpen && counts.free > 0;
  const nums = [...selected].sort((a, b) => a - b);
  const total = nums.length * lot.priceCents;

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }

  function toggle(n: number) {
    if (!canBuy) return;
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  function pickForMe() {
    const free = packs.filter((p) => p.state === "free" && !selected.has(p.n)).map((p) => p.n);
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    const chosen = free.slice(0, pick);
    if (!chosen.length) return flash("Não há mais pacotes disponíveis.");
    setSelected((s) => new Set([...s, ...chosen]));
    flash(`${chosen.length} ${chosen.length === 1 ? "pacote escolhido" : "pacotes escolhidos"} ao acaso`);
  }

  function goTab(t: "packs" | "pot") {
    setTab(t);
    document.getElementById("lotp-pacotes")?.scrollIntoView({ behavior: "smooth" });
  }

  const tierCodes = (id: string) => Object.keys(pot.all).filter((c) => legendTierOf(c)?.id === id);
  const potCodes = Object.keys(pot.all)
    .filter((c) => !tier || legendTierOf(c)?.id === tier)
    .sort((a, b) => {
      const ta = LEGEND_TIERS.findIndex((t) => t.id === legendTierOf(a)?.id);
      const tb = LEGEND_TIERS.findIndex((t) => t.id === legendTierOf(b)?.id);
      return tb - ta || (pot.left[b] ? 1 : 0) - (pot.left[a] ? 1 : 0) || legendName(a).localeCompare(legendName(b));
    });
  const fan = (() => {
    const order = ["OUR", "PRA", "BRO", "LIL"];
    const codes = Object.keys(pot.left).sort((a, b) => order.indexOf(legendTierOf(a)?.id ?? "") - order.indexOf(legendTierOf(b)?.id ?? ""));
    return codes.length >= 3 ? [codes[1], codes[0], codes[2]] : codes;
  })();

  return (
    <div className="lotp">
      <div className={`lotp-band${shop.official ? " is-official" : ""}`}>
        <header className="lotp-wrap lotp-nav">
          <a href={`/${shop.slug}`} className="lotp-brand" aria-label={`Loja ${shop.name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lotp-shop-logo" src={shop.logoUrl || "/brand/logo.webp"} alt="" />
            <span className="lotp-shop-name">{shop.name}</span>
          </a>
          <nav className="lotp-navlinks">
            <a href="#lotp-perguntas" className="lotp-navlink">
              Dúvidas
            </a>
            <a href={`/${shop.slug}`} className="lotp-btn lotp-btn-ghost-light lotp-small">
              Ver a loja
            </a>
          </nav>
        </header>

        {isOwner && lot.status !== "ativo" && (
          <div className="lotp-wrap">
            <div className="lotp-owner">
              Prévia: só você vê esta página enquanto o lote está {lot.status === "rascunho" ? "em rascunho" : "pausado"}.
            </div>
          </div>
        )}

        <div className="lotp-wrap lotp-hero">
          <div>
            <div className="lotp-pill">{lot.title} · Copa do Mundo 2026</div>
            <h1>
              Pacote<em>Legends</em>
            </h1>
            <p className="lotp-lead">
              Cada pacote traz <b>1 Legend garantida</b> e mais <b>7 figurinhas</b> da Copa 2026. Você escolhe o número, abre aqui na tela e
              recebe tudo em casa.
            </p>
            {lot.description && <p className="lotp-desc">{lot.description}</p>}
            <div className="lotp-buy">
              <div className="lotp-price">
                <b>{formatBRL(lot.priceCents)}</b>
                <span>por pacote · frete combinado no WhatsApp</span>
              </div>
              {packs.length > 0 && (
                <div className="lotp-progress">
                  <div className="lotp-bar">
                    <i className="b-open" style={{ width: `${(counts.open / packs.length) * 100}%` }} />
                    <i className="b-sold" style={{ width: `${(counts.sold / packs.length) * 100}%` }} />
                    <i className="b-res" style={{ width: `${(counts.res / packs.length) * 100}%` }} />
                  </div>
                  <small>
                    <b>
                      {counts.free} de {packs.length} pacotes disponíveis
                    </b>
                    {counts.open > 0 && ` · ${counts.open} já ${counts.open === 1 ? "aberto" : "abertos"}`}
                  </small>
                </div>
              )}
              {startsLater && <div className="lotp-soon">As vendas começam {formatAuctionDate(lot.startsAt!)}.</div>}
              {salesOpen && counts.free === 0 && <div className="lotp-soon">Todos os pacotes deste lote já foram reservados.</div>}
              <div className="lotp-hero-ctas">
                <button className="lotp-btn lotp-btn-gold" onClick={() => goTab("packs")}>
                  {canBuy ? "Escolher pacotes" : "Ver os pacotes"}
                </button>
                <button className="lotp-btn lotp-btn-ghost-light" onClick={() => goTab("pot")}>
                  Ver as Legends
                </button>
              </div>
              <ul className="lotp-trust">
                <li>Figurinhas originais</li>
                <li>Sem repetidas no pacote</li>
                <li>Envio para todo o Brasil</li>
              </ul>
            </div>
          </div>
          {lot.imageUrl ? (
            <div className="lotp-visual has-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lotp-hero-img" src={lot.imageUrl} alt={lot.title} />
            </div>
          ) : (
            <div className="lotp-visual" aria-hidden="true">
              <div className="lotp-glow" />
              {fan.map((c, i) => (
                <div key={c} className={`lotp-fan f${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(c, "large")} alt="" />
                </div>
              ))}
              <Envelope seller={shop.name} className="lotp-env" />
            </div>
          )}
        </div>
      </div>

      <section id="lotp-pacotes" className="lotp-section lotp-packs-section">
        <div className="lotp-wrap">
          <div className="lotp-eyebrow">
            {lot.title} · {packs.length || potAll} pacotes
          </div>
          <h2>Escolha seu pacote. Descubra sua Legend.</h2>

          {feed.length > 0 && (
            <div className="lotp-feed" aria-label="Últimos pacotes abertos">
              {feed.map((p) => (
                <button key={p.n} className="lotp-feed-item" onClick={() => setOpened(p)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(p.legend!)} alt="" />
                  <span>
                    <b>{p.who?.first}</b> · {p.who?.place} abriu o nº {pad(p.n)} e tirou{" "}
                    <b>
                      {legendName(p.legend!)} {legendTierOf(p.legend!)?.name}
                    </b>
                    <small>{agoText(p.openedAt!, now)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="lotp-tabs" role="tablist" aria-label="O que ver">
            <button role="tab" aria-selected={tab === "packs"} onClick={() => setTab("packs")}>
              Pacotes<small>{packs.length ? `${counts.free} disponíveis` : "em breve"}</small>
            </button>
            <button role="tab" aria-selected={tab === "pot"} onClick={() => setTab("pot")}>
              Legends no pote<small>{potLeft} restantes</small>
            </button>
          </div>

          {tab === "pot" && (
            <div role="tabpanel">
              <p className="lotp-lead lotp-panel-lead">
                Estas são as Legends deste lote. A sua é escolhida ao acaso entre as que ainda estão no pote, no momento em que você abre o
                pacote. Cada unidade restante tem a mesma chance.
              </p>
              <div className="lotp-tiers">
                {[...LEGEND_TIERS].reverse().map((t) => {
                  const n = tierCodes(t.id).reduce((s, c) => s + (pot.left[c] ?? 0), 0);
                  const pct = potLeft ? Math.round((n / potLeft) * 100) : 0;
                  return (
                    <button
                      key={t.id}
                      className="lotp-tier"
                      style={{ ["--tc" as string]: TIER_COLOR[t.id] }}
                      aria-pressed={tier === t.id}
                      onClick={() => setTier(tier === t.id ? null : t.id)}
                    >
                      <i />
                      <b>{n}</b>
                      <span>{t.name}</span>
                      <small>{pct}% de chance</small>
                    </button>
                  );
                })}
              </div>
              <div className="lotp-pot">
                {potCodes.map((c) => {
                  const l = pot.left[c] ?? 0;
                  const a = pot.all[c] ?? 0;
                  return (
                    <div key={c} className={`lotp-leg${l ? "" : " is-out"}${l >= 3 ? " m3" : l === 2 ? " m2" : ""}`}>
                      <div className="lotp-leg-ph">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img(c)} alt={`${legendName(c)} ${legendTierOf(c)?.name}`} loading="lazy" />
                        {l > 1 && <span className="lotp-leg-qty">×{l}</span>}
                      </div>
                      <span className="lotp-leg-nm">{legendName(c)}</span>
                      {a > 1 && (
                        <span className="lotp-units">
                          {Array.from({ length: a }, (_, i) => (
                            <i key={i} className={i < l ? "" : "gone"} />
                          ))}
                          <span>{l ? `${l} de ${a}` : "esgotada"}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="lotp-note">
                {potLeft} {potLeft === 1 ? "Legend ainda no pote" : "Legends ainda no pote"}, de {potAll} no lote.{" "}
                {tier ? "Toque de novo na cor para ver todas." : "Toque numa cor para filtrar."}
              </p>
              <button className="lotp-btn lotp-btn-gold lotp-full" onClick={() => goTab("packs")}>
                Escolher meus pacotes
              </button>
            </div>
          )}

          {tab === "packs" && (
            <div role="tabpanel">
              {packs.length === 0 ? (
                <p className="lotp-lead lotp-panel-lead">A grade de pacotes aparece quando o lote for colocado à venda.</p>
              ) : (
                <>
                  <p className="lotp-lead lotp-panel-lead">
                    {canBuy ? "Toque nos números livres." : startsLater ? "A escolha dos números abre no início das vendas." : ""} Pacotes
                    abertos mostram a Legend que saiu e quem abriu.
                  </p>
                  <div className="lotp-grid-head">
                    <div className="lotp-filters">
                      {(
                        [
                          ["all", "Todos"],
                          ["free", "Disponíveis"],
                          ["open", "Abertos"],
                        ] as const
                      ).map(([f, label]) => (
                        <button key={f} className="lotp-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {canBuy && (
                      <div className="lotp-pick">
                        <span>Escolher pra mim</span>
                        <div className="lotp-step">
                          <button aria-label="Menos" onClick={() => setPick((p) => Math.max(1, p - 1))}>
                            −
                          </button>
                          <output>{pick}</output>
                          <button aria-label="Mais" onClick={() => setPick((p) => Math.min(50, p + 1))}>
                            +
                          </button>
                        </div>
                        <button className="lotp-btn lotp-btn-ghost lotp-small" onClick={pickForMe}>
                          Escolher
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="lotp-grid">
                    {packs
                      .filter((p) => filter === "all" || (filter === "free" ? p.state === "free" : p.state === "open"))
                      .map((p) => {
                        if (p.state === "open")
                          return (
                            <button key={p.n} className="lotp-cell is-open" onClick={() => setOpened(p)} aria-label={`Pacote ${pad(p.n)}, aberto`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img(p.legend!)} alt="" />
                              <span className="n">{pad(p.n)}</span>
                            </button>
                          );
                        if (p.state === "res")
                          return (
                            <div key={p.n} className="lotp-cell is-res" aria-label={`Pacote ${pad(p.n)}, reservado`}>
                              <span className="lbl">Reservado</span>
                              <span className="n">{pad(p.n)}</span>
                            </div>
                          );
                        if (p.state === "sold")
                          return (
                            <div key={p.n} className="lotp-cell is-sold" aria-label={`Pacote ${pad(p.n)}, pago`}>
                              <span className="lbl">Pago</span>
                              <span className="n">{pad(p.n)}</span>
                            </div>
                          );
                        const sel = selected.has(p.n);
                        return (
                          <button
                            key={p.n}
                            className={`lotp-cell ${sel ? "is-sel" : "is-free"}`}
                            aria-pressed={sel}
                            aria-label={`Pacote ${pad(p.n)}`}
                            disabled={!canBuy}
                            onClick={() => toggle(p.n)}
                          >
                            <span className="lbl">{sel ? "✓ Seu" : "Legends"}</span>
                            <span className="n">{pad(p.n)}</span>
                          </button>
                        );
                      })}
                  </div>
                  <div className="lotp-key">
                    <span>
                      <i className="k-free" />
                      Disponível
                    </span>
                    <span>
                      <i className="k-sel" />
                      Selecionado
                    </span>
                    <span>
                      <i className="k-res" />
                      Reservado (aguardando pagamento)
                    </span>
                    <span>
                      <i className="k-sold" />
                      Pago, ainda fechado
                    </span>
                    <span>
                      <i className="k-open" />
                      Aberto
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="lotp-section lotp-dark">
        <div className="lotp-wrap">
          <div className="lotp-eyebrow">Como funciona</div>
          <h2>Do pedido à sua Legend</h2>
          <div className="lotp-steps">
            <div className="lotp-stp">
              <span className="k">1</span>
              <b>Escolha os números</b>
              <p>Quantos pacotes quiser. Eles ficam reservados para você por 24 horas.</p>
            </div>
            <div className="lotp-stp">
              <span className="k">2</span>
              <b>Envie o pedido no WhatsApp</b>
              <p>A loja responde com os dados do Pix e combina o frete com você.</p>
            </div>
            <div className="lotp-stp">
              <span className="k">3</span>
              <b>Abra aqui na tela</b>
              <p>Com o pagamento confirmado, você recebe o link e abre pacote por pacote.</p>
            </div>
            <div className="lotp-stp">
              <span className="k">4</span>
              <b>Receba em casa</b>
              <p>As 8 figurinhas de cada pacote são separadas e enviadas para o seu endereço.</p>
            </div>
          </div>
          <div className="lotp-perks">
            <div>
              <b>Nada repetido no pacote</b>
              <p>As 7 figurinhas de cada pacote são sempre diferentes entre si.</p>
            </div>
            <div>
              <b>Evitamos as que você já tem</b>
              <p>Se você tem conta na GN Coleciona, damos prioridade às figurinhas que faltam na sua coleção.</p>
            </div>
            <div>
              <b>Tudo à vista</b>
              <p>O pote mostra o que ainda pode sair e a grade mostra o que saiu em cada pacote aberto.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="lotp-perguntas" className="lotp-section">
        <div className="lotp-wrap">
          <div className="lotp-eyebrow">Dúvidas</div>
          <h2>Perguntas frequentes</h2>
          <details>
            <summary>Posso escolher qual Legend vem?</summary>
            <p>
              Não. A Legend é escolhida ao acaso entre as que ainda estão no pote deste lote, no momento em que você abre o pacote. O número do
              pacote não muda a chance.
            </p>
          </details>
          <details>
            <summary>Como eu pago?</summary>
            <p>
              Depois do pedido, você envia a mensagem pronta no WhatsApp da loja {shop.name}. A loja responde com os dados do Pix e combina o
              frete.
            </p>
          </details>
          <details>
            <summary>Quanto custa o frete?</summary>
            <p>O frete é combinado pelo WhatsApp, de acordo com o seu CEP e a quantidade de pacotes.</p>
          </details>
          <details>
            <summary>Quanto tempo meus pacotes ficam reservados?</summary>
            <p>24 horas a partir do pedido. Se o pagamento não for confirmado nesse prazo, os números voltam a ficar disponíveis.</p>
          </details>
          <details>
            <summary>Por que meu nome aparece na grade?</summary>
            <p>Quando um pacote é aberto, a grade mostra a Legend que saiu, o primeiro nome e a cidade de quem abriu. Nada além disso é exibido.</p>
          </details>
          <details>
            <summary>Posso cancelar?</summary>
            <p>Fale com a loja pelo WhatsApp antes de abrir o pacote. Depois de aberto, não é possível cancelar.</p>
          </details>
        </div>
      </section>

      {canBuy && (
        <section className="lotp-final">
          <div className="lotp-wrap">
            <h2>Sua Legend está em um destes pacotes.</h2>
            <p>
              Restam {counts.free} de {packs.length} pacotes neste lote.
            </p>
            <button className="lotp-btn lotp-btn-gold" onClick={() => goTab("packs")}>
              Escolher meus pacotes
            </button>
          </div>
        </section>
      )}

      <footer className="lotp-footer">
        <a href={`/${shop.slug}`} className="lotp-footer-shop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shop.logoUrl || "/brand/logo.webp"} alt="" />
          <span>
            <b>{shop.name}</b>
            Veja as figurinhas avulsas e os produtos da loja →
          </span>
        </a>
        <p>Pacote Legends na GN Coleciona</p>
      </footer>

      {packs.length > 0 && (
        <div className="lotp-sticky">
          <div className="lotp-sticky-in">
            <div>
              {nums.length ? (
                <>
                  <b>
                    {nums.length} {nums.length === 1 ? "pacote" : "pacotes"} · {formatBRL(total)}
                  </b>
                  <small>Nº {nums.map(pad).join(", ")}</small>
                </>
              ) : (
                <>
                  <b>{canBuy ? "Nenhum pacote selecionado" : startsLater ? "Vendas em breve" : "Sem pacotes disponíveis"}</b>
                  <small>{formatBRL(lot.priceCents)} por pacote</small>
                </>
              )}
            </div>
            <button
              className="lotp-btn lotp-btn-gold"
              disabled={!canBuy}
              onClick={() => (nums.length ? setCheckout(true) : goTab("packs"))}
            >
              {nums.length ? "Continuar" : "Escolher pacotes"}
            </button>
          </div>
        </div>
      )}

      {opened && (
        <div className="lotp-overlay" onClick={() => setOpened(null)} role="dialog" aria-modal="true">
          <div className="lotp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="lotp-eyebrow lotp-center">Pacote nº {pad(opened.n)} · aberto</div>
            <div className="lotp-pop-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(opened.legend!, "large")} alt="" />
            </div>
            <h3 className="lotp-center">{legendName(opened.legend!)}</h3>
            <p className="lotp-center lotp-muted">
              Legend {legendTierOf(opened.legend!)?.name} · aberto por <b>{opened.who?.first}</b>, {opened.who?.place}
            </p>
            <button className="lotp-btn lotp-btn-ghost" onClick={() => setOpened(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {checkout && (
        <PackCheckout
          lotId={lot.id}
          numbers={nums}
          priceCents={lot.priceCents}
          minOrderCents={data.minOrderCents}
          shopName={shop.name}
          onClose={() => setCheckout(false)}
          onTaken={(taken) => {
            setSelected((s) => new Set([...s].filter((n) => !taken.includes(n))));
            router.refresh();
          }}
          onOrdered={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}

      {toast && <div className="lotp-toast">{toast}</div>}
    </div>
  );
}
