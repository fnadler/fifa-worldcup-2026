"use client";

import { useEffect, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { legendName, legendTierOf } from "@/lib/packs";
import { packsUrl, packsWhatsappText } from "@/lib/packsMessages";
import { formatDateTimeBR, itemOrder, whatsappLink, type Order } from "@/lib/shop";
import { createClient } from "@/lib/supabase/client";

// Pacotes de um pedido, no painel da loja: aviso antes de confirmar, link e avisos ao comprador depois de
// confirmar, e a lista de separação (as 7 figurinhas de cada pacote e a Legend, quando o pacote é aberto).

interface PackRow {
  number: number;
  commons: string[] | null;
  legend_code: string | null;
  opened_at: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function OrderPacks({
  order,
  status,
  shopName,
  onToast,
  onNotified,
}: {
  order: Order;
  /** Situação efetiva (novo vencido conta como cancelado). */
  status: "novo" | "confirmado" | "cancelado";
  shopName: string;
  onToast: (msg: string) => void;
  onNotified: () => void;
}) {
  const [packs, setPacks] = useState<PackRow[] | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let vivo = true;
    void createClient()
      .from("packs")
      .select("number, commons, legend_code, opened_at")
      .eq("order_id", order.id)
      .order("number")
      .then(({ data }) => {
        if (vivo) setPacks((data as PackRow[] | null) ?? []);
      });
    return () => {
      vivo = false;
    };
  }, [order.id, status]);

  if (packs === null) return null;
  if (packs.length === 0) {
    return status === "cancelado" ? <p className="order-packs-note">Os números deste pedido voltaram para o lote.</p> : null;
  }

  const numbers = packs.map((p) => p.number);
  const abertos = packs.filter((p) => p.opened_at).length;
  const url = order.packToken ? packsUrl(order.packToken) : null;
  const wa =
    order.packToken &&
    whatsappLink(order.buyer.whatsapp, packsWhatsappText({ buyerName: order.buyer.name, code: order.code, token: order.packToken, numbers, shopName }));

  async function reenviar() {
    setSending(true);
    try {
      const res = await fetch("/api/pacotes/aviso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, force: !!order.packsNotifiedAt }),
      });
      const data = (await res.json()) as { sent?: boolean; error?: string };
      onToast(data.sent ? `E-mail com o link dos pacotes enviado para ${order.buyer.email}.` : (data.error ?? "Não foi possível enviar o e-mail."));
      if (data.sent) onNotified();
    } catch {
      onToast("Sem conexão — tente de novo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="order-packs">
      {status === "novo" && (
        <p className="order-packs-warn">
          Combine o frete antes de confirmar: ao confirmar, os pacotes são liberados para o comprador abrir e ele recebe o e-mail com o link.
        </p>
      )}

      {status === "confirmado" && url && (
        <div className="order-packs-links">
          <div className="order-packs-url">
            <span>Link dos pacotes</span>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {url.replace(/^https:\/\/(www\.)?/, "")}
            </a>
          </div>
          <div className="order-packs-actions">
            {wa && (
              <a className="btn-restore btn-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
                Avisar no WhatsApp
              </a>
            )}
            <button type="button" className="btn-ghost" onClick={() => void copyText(url).then(() => onToast("Link copiado."))}>
              Copiar link
            </button>
            <button type="button" className="btn-ghost" disabled={sending} onClick={() => void reenviar()}>
              {sending ? "Enviando…" : order.packsNotifiedAt ? "Reenviar e-mail" : "Enviar e-mail"}
            </button>
          </div>
          <small className="order-packs-note">
            {order.packsNotifiedAt ? `E-mail enviado em ${formatDateTimeBR(order.packsNotifiedAt)}.` : "O e-mail ainda não foi enviado."}{" "}
            {abertos === packs.length ? "Todos os pacotes foram abertos." : `${abertos} de ${packs.length} ${packs.length === 1 ? "aberto" : "abertos"}.`}
          </small>
        </div>
      )}

      <div className="order-packs-list">
        <span className="order-items-title">
          Separação · {packs.length} {packs.length === 1 ? "pacote" : "pacotes"}
        </span>
        {packs.map((p) => {
          const tier = p.legend_code ? legendTierOf(p.legend_code) : undefined;
          return (
            <div key={p.number} className="order-pack">
              <div className="order-pack-head">
                <strong>Nº {pad(p.number)}</strong>
                <span className={p.legend_code ? "order-pack-legend is-drawn" : "order-pack-legend"}>
                  {p.legend_code ? `Legend: ${legendName(p.legend_code)} ${tier?.name ?? ""} · aberto` : "Legend sorteada na abertura"}
                </span>
              </div>
              <div className="order-pack-commons">
                {[...(p.commons ?? [])]
                  .sort((a, b) => itemOrder(a) - itemOrder(b))
                  .map((c) => (
                    <span key={c}>{c}</span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
