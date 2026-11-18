"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTimeBR } from "@/lib/shop";
import { legendName, legendTierOf } from "@/lib/packs";
import type { BuyerPacks } from "@/lib/packsBuyer";
import { stickerImage } from "@/lib/stickerImages";
import Envelope from "./Envelope";
import PackOpening, { type PackContent } from "./PackOpening";
import PackResult from "./PackResult";
import CollectCard from "./CollectCard";
import { shareLegend } from "./shareLegend";

// Pacotes do comprador: bloqueados enquanto o pagamento não é confirmado; depois, abertos um de cada vez
// (PackOpening) e revistos no resumo (PackResult).

const pad = (n: number) => String(n).padStart(2, "0");

type View = { kind: "hub" } | { kind: "open"; n: number } | { kind: "result"; n: number } | { kind: "all" };

export default function PackHub({ data }: { data: BuyerPacks }) {
  const router = useRouter();
  const { shop, lot, packs, state } = data;
  const [results, setResults] = useState<Record<number, PackContent>>(() =>
    Object.fromEntries(packs.filter((p) => p.opened && p.legend).map((p) => [p.number, { legend: p.legend!, commons: p.commons }]))
  );
  const [view, setView] = useState<View>({ kind: "hub" });
  const [collected, setCollected] = useState<Set<number>>(() => new Set(packs.filter((p) => p.collected).map((p) => p.number)));
  const [toast, setToast] = useState<string | null>(null);
  const lotUrl =
    shop.slug && lot ? `https://www.gncoleciona.com.br/${shop.slug}/pacotes/${lot.slug}` : "https://www.gncoleciona.com.br";
  const pendingCollect = Object.keys(results)
    .map(Number)
    .filter((n) => !collected.has(n)).length * 8;

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }
  const closed = packs.filter((p) => !results[p.number]).map((p) => p.number);
  const fechados = closed.length;
  const nextAfter = (n: number) => closed.filter((x) => x !== n);

  function goHub() {
    setView({ kind: "hub" });
    router.refresh();
    window.scrollTo({ top: 0 });
  }
  const lotHref = shop.slug && lot ? `/${shop.slug}/pacotes/${lot.slug}` : shop.slug ? `/${shop.slug}` : "/";

  const titulo =
    state === "aguardando"
      ? "Seus pacotes estão reservados"
      : state === "cancelado"
        ? "Este pedido foi cancelado"
        : fechados === 0
          ? "Todos os pacotes abertos"
          : `${data.buyerFirstName ? `${data.buyerFirstName}, s` : "S"}eus pacotes chegaram!`;

  return (
    <div className="lotp">
      <div className="lotp-band">
        <header className="lotp-wrap lotp-nav">
          <a href={shop.slug ? `/${shop.slug}` : "/"} className="lotp-brand" aria-label={`Loja ${shop.name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lotp-shop-logo" src={shop.logoUrl || "/brand/logo.webp"} alt="" />
            <span className="lotp-shop-name">{shop.name}</span>
          </a>
          <span className="lotp-navlink">Pedido #{data.code}</span>
        </header>
        <div className="lotp-wrap lotp-hub-head">
          <div className="lotp-pill">
            {lot ? `${lot.title} · ` : ""}
            {packs.length} {packs.length === 1 ? "Pacote Legends" : "Pacotes Legends"}
          </div>
          <h1 className="lotp-hub-title">{titulo}</h1>
          <p className="lotp-lead">
            {state === "aguardando" && (
              <>
                Assim que a loja confirmar o seu pagamento, os pacotes são liberados aqui e você recebe o aviso por e-mail. Eles ficam reservados até{" "}
                <b>{formatDateTimeBR(data.reservedUntil)}</b>. Guarde este link.
              </>
            )}
            {state === "cancelado" && <>O prazo de pagamento terminou ou o pedido foi cancelado pela loja. Os números voltaram para o lote.</>}
            {state === "pronto" &&
              (fechados > 0 ? (
                <>
                  Cada pacote tem <b>7 figurinhas da Copa 2026</b> e mais <b>1 Legend</b>, sorteada do pote na hora em que você abre.
                </>
              ) : (
                <>Tudo o que veio está aqui embaixo. A loja separa as figurinhas e envia para o seu endereço.</>
              ))}
          </p>
        </div>
      </div>

      <section className="lotp-section">
        <div className="lotp-wrap">
          {view.kind === "all" ? (
            <div className="po-all">
              <h2 className="lotp-center">Tudo o que veio</h2>
              <p className="lotp-muted lotp-center">
                {packs.length} {packs.length === 1 ? "pacote" : "pacotes"} · {packs.length} {packs.length === 1 ? "Legend" : "Legends"} ·{" "}
                {packs.length * 7} figurinhas da Copa 2026. A loja separa tudo e envia para o seu endereço.
              </p>
              {packs
                .filter((p) => results[p.number])
                .map((p) => {
                  const r = results[p.number];
                  return (
                    <div key={p.number} className="po-all-pack">
                      <div className="po-all-head">
                        <strong>Nº {pad(p.number)}</strong>
                        <span>
                          {legendName(r.legend)} · Legend {legendTierOf(r.legend)?.name}
                        </span>
                        <button
                          className="po-all-share"
                          onClick={() =>
                            void shareLegend({ legend: r.legend, shopName: shop.name, lotUrl })
                              .then((s) => s === "downloaded" && flash("Imagem baixada. Poste nas suas redes!"))
                              .catch(() => flash("Não foi possível gerar a imagem — tente de novo."))
                          }
                        >
                          Compartilhar
                        </button>
                      </div>
                      <div className="po-all-row">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="is-legend" src={stickerImage(r.legend, "thumb") ?? ""} alt={legendName(r.legend)} />
                        {r.commons.map((c) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={c} src={stickerImage(c, "thumb") ?? ""} alt={`Figurinha ${c}`} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              <div className="lotp-hub-cta">
                <button className="lotp-btn lotp-btn-gold" onClick={goHub}>
                  Voltar aos pacotes
                </button>
              </div>
            </div>
          ) : view.kind === "result" && results[view.n] ? (
            <PackResult
              number={view.n}
              total={packs.length}
              content={results[view.n]}
              remaining={fechados}
              shopName={shop.name}
              lotUrl={lotUrl}
              onNext={() => closed[0] && setView({ kind: "open", n: closed[0] })}
              onBack={goHub}
            />
          ) : state === "cancelado" ? (
            <a className="lotp-btn lotp-btn-gold" href={lotHref}>
              Ver os pacotes disponíveis
            </a>
          ) : (
            <>
              <div className={`lotp-hub${state === "aguardando" ? " is-locked" : ""}`}>
                {packs.map((p) => {
                  const r = results[p.number];
                  return (
                    <button
                      key={p.number}
                      className={`lotp-hub-pack${r ? " is-opened" : ""}`}
                      disabled={state !== "pronto"}
                      onClick={() => setView(r ? { kind: "result", n: p.number } : { kind: "open", n: p.number })}
                      aria-label={r ? `Pacote nº ${pad(p.number)}: ver o que veio` : `Abrir o pacote nº ${pad(p.number)}`}
                    >
                      {r ? (
                        <div className="lotp-hub-legend">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={stickerImage(r.legend, "large") ?? ""} alt="" />
                        </div>
                      ) : (
                        <Envelope seller={shop.name} logoUrl={shop.logoUrl} className="lotp-hub-env" />
                      )}
                      <span className="lotp-hub-label">
                        Nº {pad(p.number)}
                        {r ? (
                          <>
                            <small className="lotp-hub-legend-name">
                              {legendName(r.legend)} · {legendTierOf(r.legend)?.name ?? ""}
                            </small>
                            <small className="lotp-hub-more">+ 7 figurinhas</small>
                          </>
                        ) : (
                          <small>{state === "aguardando" ? "Aguardando pagamento" : "Pronto para abrir"}</small>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {state === "pronto" && fechados === 0 && packs.length > 0 && (
                <div className="lotp-hub-cta">
                  <button className="lotp-btn lotp-btn-gold" onClick={() => setView({ kind: "all" })}>
                    Ver tudo o que veio
                  </button>
                </div>
              )}
              {state === "pronto" && fechados > 0 && (
                <div className="lotp-hub-cta">
                  <button className="lotp-btn lotp-btn-gold" onClick={() => setView({ kind: "open", n: closed[0] })}>
                    Abrir o pacote nº {pad(closed[0])}
                  </button>
                </div>
              )}
            </>
          )}
          {state === "pronto" && view.kind !== "open" && (
            <CollectCard
              token={data.token}
              viewer={data.viewer}
              pending={pendingCollect}
              done={collected.size > 0}
              onCollected={(added) => {
                setCollected(new Set(Object.keys(results).map(Number)));
                flash(`${added} figurinhas marcadas na sua coleção.`);
              }}
            />
          )}
        </div>
      </section>

      <footer className="lotp-footer">
        {shop.slug && (
          <a href={`/${shop.slug}`} className="lotp-footer-shop">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shop.logoUrl || "/brand/logo.webp"} alt="" />
            <span>
              <b>{shop.name}</b>
              Veja as figurinhas avulsas e os produtos da loja →
            </span>
          </a>
        )}
        <p>Pacote Legends na GN Coleciona</p>
      </footer>

      {toast && <div className="lotp-toast">{toast}</div>}

      {view.kind === "open" && (
        <PackOpening
          key={view.n}
          token={data.token}
          number={view.n}
          seller={shop.name}
          logoUrl={shop.logoUrl}
          remaining={nextAfter(view.n).length}
          onOpened={(c) => setResults((r) => ({ ...r, [view.n]: c }))}
          onNext={() => {
            const n = nextAfter(view.n)[0];
            if (n) setView({ kind: "open", n });
          }}
          onSummary={() => {
            setView({ kind: "all" });
            router.refresh();
            window.scrollTo({ top: 0 });
          }}
          onClose={() => (results[view.n] ? setView({ kind: "result", n: view.n }) : goHub())}
        />
      )}
    </div>
  );
}
