"use client";

import { formatDateTimeBR } from "@/lib/shop";
import { legendName, legendTierOf } from "@/lib/packs";
import type { BuyerPacks } from "@/lib/packsBuyer";
import { stickerImage } from "@/lib/stickerImages";
import Envelope from "./Envelope";

// Pacotes do comprador: bloqueados enquanto o pagamento não é confirmado, prontos para abrir depois.

const pad = (n: number) => String(n).padStart(2, "0");

export default function PackHub({ data }: { data: BuyerPacks }) {
  const { shop, lot, packs, state } = data;
  const fechados = packs.filter((p) => !p.opened).length;
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
          {state === "cancelado" ? (
            <a className="lotp-btn lotp-btn-gold" href={lotHref}>
              Ver os pacotes disponíveis
            </a>
          ) : (
            <>
              <div className={`lotp-hub${state === "aguardando" ? " is-locked" : ""}`}>
                {packs.map((p) => (
                  <div key={p.number} className={`lotp-hub-pack${p.opened ? " is-opened" : ""}`}>
                    {p.opened && p.legend ? (
                      <div className="lotp-hub-legend">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={stickerImage(p.legend, "large") ?? ""} alt={`${legendName(p.legend)} ${legendTierOf(p.legend)?.name ?? ""}`} />
                      </div>
                    ) : (
                      <Envelope seller={shop.name} className="lotp-hub-env" />
                    )}
                    <span className="lotp-hub-label">
                      Nº {pad(p.number)}
                      <small>
                        {state === "aguardando"
                          ? "Aguardando pagamento"
                          : p.opened && p.legend
                            ? `${legendName(p.legend)} · ${legendTierOf(p.legend)?.name ?? ""}`
                            : "Pronto para abrir"}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
              {state === "pronto" && fechados > 0 && (
                <p className="lotp-note lotp-center">Em breve você poderá abrir seus pacotes aqui, um de cada vez.</p>
              )}
            </>
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
    </div>
  );
}
