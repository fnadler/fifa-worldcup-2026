import { landing } from "@/content/landing";

// Ilustração da marca: o cartão de uma seleção com a grade de figurinhas e o selo de repetidas.
// Usada no topo da landing e nas telas de acesso.

const q = (n: number) => (n === 0 ? "q0" : n === 1 ? "q1" : "q2");

export default function HeroMock() {
  const h = landing.hero;
  const repetidas = h.grid.reduce((s, n) => s + Math.max(n - 1, 0), 0);
  return (
    <div className="mk-hero-visual" aria-hidden="true">
      <div className="mk-hero-card">
        <div className="mk-hero-card-head">
          <strong>Brasil</strong>
          <small>BRA1–20</small>
          <b>17/20</b>
        </div>
        <div className="mk-progress">
          <div style={{ width: "85%" }} />
        </div>
        <div className="mk-grid-5">
          {h.grid.map((n, i) => (
            <div key={i} className={`mk-cell ${q(n)}`}>
              {i + 1}
              {n > 1 && <span className="mk-cell-badge">+{n - 1}</span>}
            </div>
          ))}
        </div>
        <div className="mk-legend">
          <span>
            <i style={{ background: "var(--gn-green)" }} />
            tenho
          </span>
          <span>
            <i style={{ background: "var(--gn-yellow)" }} />
            repetida
          </span>
          <span>
            <i style={{ border: "1.5px dashed #b9cabf" }} />
            falta
          </span>
        </div>
      </div>
      <div className="mk-hero-badge">
        <span>{repetidas}</span>
        <div>
          <strong>{h.badgeTitle}</strong>
          <small>{h.badgeSub}</small>
        </div>
      </div>
    </div>
  );
}
