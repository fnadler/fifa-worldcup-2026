import { FUNNEL_LABEL, FUNNEL_STEPS, SOURCE_LABEL } from "@/lib/packFunnel";
import type { LotFunnel as Funnel } from "@/lib/packsServer";

// Funil da página do lote no painel: quantas pessoas chegaram a cada etapa e de onde vieram.
// Ajuda a separar problema de divulgação (pouca visita) de problema de oferta (visita sem pedido).

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

function leitura(t: Funnel["total"]): string {
  if (t.view === 0) return "Ninguém visitou a página ainda (desde que a medição começou).";
  if (t.view < 30) return "Poucas visitas até agora: antes de mexer na oferta, vale divulgar mais o link do lote.";
  if (t.pick / t.view < 0.15) return "Muita gente visita, mas pouca gente toca em um pacote: a oferta (preço, Legends do pote) ou a página não estão convencendo.";
  if (t.checkout > 0 && t.order / t.checkout < 0.3) return "As pessoas abrem o pedido, mas desistem no formulário: o passo do pedido está pesado.";
  if (t.pick > 0 && t.checkout / t.pick < 0.3) return "As pessoas escolhem pacotes, mas não abrem o pedido: talvez o preço total assuste na barra de compra.";
  return "O funil está andando. Compare as origens para ver qual divulgação traz mais pedidos.";
}

export default function LotFunnel({ funnel }: { funnel: Funnel }) {
  const { total, bySource, last24h } = funnel;
  const max = Math.max(total.view, 1);
  return (
    <section className="admin-section">
      <h2 className="admin-section-title">Funil da página</h2>
      <p className="pack-hint">
        Pessoas (não cliques) que chegaram a cada etapa. {last24h > 0 && <b>{last24h} visitaram nas últimas 24h.</b>} Visitas suas, logado
        como lojista, não contam.
      </p>
      <div className="pack-funnel">
        {FUNNEL_STEPS.map((s, i) => (
          <div key={s} className="pack-funnel-row">
            <div className="pack-funnel-label">
              <span>{FUNNEL_LABEL[s]}</span>
              <b>{total[s]}</b>
              {i > 0 && <small>{pct(total[s], total[FUNNEL_STEPS[i - 1]])} da etapa anterior</small>}
            </div>
            <div className="pack-funnel-bar">
              <span style={{ width: `${(total[s] / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="pack-funnel-reading">{leitura(total)}</p>
      {bySource.length > 0 && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Origem</th>
                <th>Visitas</th>
                <th>Tocaram</th>
                <th>Pedido aberto</th>
                <th>Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {bySource.map(({ source, steps }) => (
                <tr key={source}>
                  <td>
                    <strong>{SOURCE_LABEL[source]}</strong>
                  </td>
                  <td>{steps.view}</td>
                  <td>{steps.pick}</td>
                  <td>{steps.checkout}</td>
                  <td>{steps.order}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="pack-hint">
        Para saber de onde vem cada visita, divulgue o link com a origem no final:{" "}
        <b>?utm_source=instagram</b>, <b>?utm_source=whatsapp</b>… O e-mail já vai marcado.
      </p>
    </section>
  );
}
