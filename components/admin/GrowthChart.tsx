import type { AdminStats } from "@/lib/adminStats";

// Evolução acumulada de contas e coleções (linhas) e contas novas por dia (barras). SVG puro, sem biblioteca.
const W = 960;
const H = 280;
const PAD = { l: 44, r: 16, t: 14, b: 30 };

const br = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export default function GrowthChart({ series }: { series: AdminStats["series"] }) {
  if (series.length < 2) return <p className="modal-notice">Ainda não há dias suficientes para o gráfico.</p>;

  const n = series.length;
  const max = Math.max(...series.map((p) => Math.max(p.users, p.collections)), 1);
  const maxNew = Math.max(...series.map((p) => p.newUsers), 1);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i / (n - 1)) * iw;
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const line = (key: "users" | "collections") => series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const bw = Math.max(2, Math.min(14, (iw / n) * 0.6));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t)).filter((v, i, a) => a.indexOf(v) === i);
  // até 8 datas no eixo
  const step = Math.max(1, Math.ceil(n / 8));
  const last = series[n - 1];

  return (
    <figure className="adm-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolução: ${last.users} contas e ${last.collections} coleções`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="adm-chart-grid" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="adm-chart-axis">
              {v}
            </text>
          </g>
        ))}
        {series.map((p, i) =>
          p.newUsers ? (
            <rect key={p.day} x={x(i) - bw / 2} width={bw} y={PAD.t + ih - (p.newUsers / maxNew) * ih * 0.35} height={(p.newUsers / maxNew) * ih * 0.35} className="adm-chart-bar">
              <title>{`${br(p.day)}: ${p.newUsers} conta${p.newUsers > 1 ? "s" : ""} nova${p.newUsers > 1 ? "s" : ""}`}</title>
            </rect>
          ) : null
        )}
        <path d={line("collections")} className="adm-chart-line is-collections" />
        <path d={line("users")} className="adm-chart-line is-users" />
        {series.map((p, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={p.day} x={x(i)} y={H - 8} textAnchor={i === n - 1 ? "end" : "middle"} className="adm-chart-axis">
              {br(p.day)}
            </text>
          ) : null
        )}
      </svg>
      <figcaption>
        <span className="adm-key is-users">Contas (acumulado): {last.users}</span>
        <span className="adm-key is-collections">Coleções (acumulado): {last.collections}</span>
        <span className="adm-key is-bar">Contas novas no dia (barras, escala própria; pico de {maxNew})</span>
      </figcaption>
    </figure>
  );
}
