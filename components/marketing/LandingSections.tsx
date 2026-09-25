import { landing, trialSteps } from "@/content/landing";
import { COLLECTION_PATH, SIGNUP_PATH, signupThen } from "@/lib/routes";
import Faq from "./Faq";
import { SmartLink } from "./Session";

// Seções da landing. Markup estático (mocks ilustrativos); só os CTAs reagem à sessão.

const CTA_COLECAO = {
  anon: { href: SIGNUP_PATH, label: "Criar coleção grátis" },
  authed: { href: COLLECTION_PATH, label: "Ir para minha coleção" },
};
const lojaCta = (label: string) => ({
  anon: { href: signupThen("/assinar"), label },
  authed: { href: "/assinar", label },
});

const q = (n: number) => (n === 0 ? "q0" : n === 1 ? "q1" : "q2");

export function Hero({ trialDays }: { trialDays: number }) {
  const h = landing.hero;
  const repetidas = h.grid.reduce((s, n) => s + Math.max(n - 1, 0), 0);
  return (
    <div id="topo" className="mk-hero-grid mk-container">
      <div className="mk-hero-copy">
        <span className="mk-pill">{h.pill}</span>
        <h1 className="mk-h1">{h.title}</h1>
        <p className="mk-hero-sub">{h.subtitle}</p>
        <div className="mk-ctas">
          <SmartLink className="mk-btn mk-btn-yellow" {...lojaCta(`Abrir minha loja — ${trialDays} dias grátis`)} />
          <SmartLink className="mk-btn mk-btn-ghost-light" {...CTA_COLECAO} />
        </div>
        <span className="mk-hero-note">{h.note}</span>
      </div>
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
    </div>
  );
}

export function ValueSplit() {
  const s = landing.split;
  return (
    <section className="mk-split mk-container">
      <div className="mk-section-head">
        <span className="mk-kicker">{s.kicker}</span>
        <h2 className="mk-h2">{s.title}</h2>
      </div>
      <div className="mk-two">
        <div className="mk-card mk-card-light">
          <div className="mk-card-title">
            <strong>Coleção</strong>
            <span className="mk-tag mk-tag-green">Grátis</span>
          </div>
          <p>{s.colecao}</p>
        </div>
        <div className="mk-card mk-card-dark">
          <div className="mk-card-title">
            <strong>Loja</strong>
            <span className="mk-tag mk-tag-yellow">Assinatura</span>
          </div>
          <p>{s.loja}</p>
        </div>
      </div>
    </section>
  );
}

export function CollectionSection() {
  const c = landing.colecao;
  return (
    <section id="colecao" className="mk-colecao mk-container">
      <div className="mk-mock" aria-hidden="true">
        <div className="mk-chips">
          {c.anchors.map((a, i) => (
            <span key={a} className={i === 3 ? "on" : ""}>
              {a}
            </span>
          ))}
        </div>
        <div className="mk-totals">
          <div style={{ background: "var(--gn-bg)" }}>
            <strong style={{ color: "var(--gn-green)" }}>{c.totals.coladas}</strong>
            <small style={{ color: "var(--gn-muted)" }}>coladas</small>
          </div>
          <div style={{ background: "#fff8d9" }}>
            <strong style={{ color: "#8a6d00" }}>{c.totals.repetidas}</strong>
            <small style={{ color: "#7a6a2a" }}>repetidas</small>
          </div>
          <div style={{ background: "#e8f6fd" }}>
            <strong style={{ color: "#0078a8" }}>{c.totals.faltam}</strong>
            <small style={{ color: "#3d6c80" }}>faltam</small>
          </div>
        </div>
        {c.blocks.map((b) => (
          <div key={b.nome} className="mk-mini">
            <div className="mk-mini-head">
              <em>{b.grupo}</em>
              <strong>{b.nome}</strong>
              <b>{b.resumo}</b>
            </div>
            <div className="mk-grid-10">
              {b.cells.map((n, i) => (
                <div key={i} className={`mk-cell sm ${q(n)}`}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mk-features-col">
        <div className="mk-section-head">
          <span className="mk-kicker">{c.kicker}</span>
          <h2 className="mk-h2">{c.title}</h2>
        </div>
        <div className="mk-features">
          {c.features.map((f, i) => (
            <div key={f.t} className="mk-feature">
              <span>{i + 1}</span>
              <div>
                <strong>{f.t}</strong>
                <p>{f.d}</p>
              </div>
            </div>
          ))}
        </div>
        <SmartLink
          className="mk-btn mk-btn-green"
          anon={{ href: SIGNUP_PATH, label: c.cta }}
          authed={{ href: COLLECTION_PATH, label: "Ir para minha coleção" }}
        />
      </div>
    </section>
  );
}

export function StoreSection() {
  const l = landing.loja;
  return (
    <section id="loja" className="mk-loja">
      <div className="mk-loja-inner mk-container">
        <div className="mk-section-head">
          <span className="mk-kicker">{l.kicker}</span>
          <h2 className="mk-h2">{l.title}</h2>
          <p>{l.subtitle}</p>
        </div>
        <div className="mk-steps">
          {l.steps.map((s, i) => (
            <div key={s.t} className="mk-step">
              <span>{i + 1}</span>
              <strong>{s.t}</strong>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
        <div className="mk-loja-cards">
          <div className="mk-price-card">
            <div>
              <strong>{l.pricing.title}</strong>
              <small>{l.pricing.subtitle}</small>
            </div>
            <div className="mk-price-group">
              <span>Por grupo</span>
              {l.pricing.grupo.map((r) => (
                <div key={r.nome} className="mk-price-row">
                  {r.nome}
                  <b>{r.preco}</b>
                </div>
              ))}
            </div>
            <div className="mk-price-group">
              <span>Individual</span>
              {l.pricing.individual.map((r) => (
                <div key={r.code} className="mk-price-row ind">
                  <em>{r.code}</em>
                  {r.nome}
                  <b>{r.preco}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="mk-wa" aria-label="Exemplo de pedido recebido no WhatsApp">
            <div className="mk-wa-head">
              <span>GN</span>
              <div>
                <strong>{l.whatsapp.title}</strong>
                <small>{l.whatsapp.sub}</small>
              </div>
            </div>
            <div className="mk-bubble in">
              <strong>{l.whatsapp.intro}</strong>
              <code>{l.whatsapp.items}</code>
              <strong>{l.whatsapp.total}</strong>
              <small>{l.whatsapp.meta}</small>
            </div>
            <div className="mk-bubble out">{l.whatsapp.reply}</div>
            <p className="mk-wa-note">{l.whatsapp.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Pricing({ price, trialDays }: { price: string; trialDays: number }) {
  const p = landing.planos;
  return (
    <section id="planos" className="mk-planos mk-container">
      <div className="mk-section-head">
        <span className="mk-kicker">{p.kicker}</span>
        <h2 className="mk-h2">{p.title}</h2>
      </div>
      <div className="mk-plans">
        <div className="mk-plan mk-plan-free">
          <div className="mk-plan-head">
            <strong>{p.free.nome}</strong>
            <div className="mk-plan-price">
              <b>R$ 0</b>
              <span>para sempre</span>
            </div>
          </div>
          <ul>
            {p.free.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <SmartLink
            className="mk-btn mk-btn-ghost-green"
            anon={{ href: SIGNUP_PATH, label: p.free.cta }}
            authed={{ href: COLLECTION_PATH, label: "Ir para minha coleção" }}
          />
        </div>
        <div className="mk-plan mk-plan-paid">
          <span className="mk-plan-badge">
            {trialDays} {p.pago.badge}
          </span>
          <div className="mk-plan-head">
            <strong>{p.pago.nome}</strong>
            <div className="mk-plan-price">
              <b>{price}</b>
              <span>/mês</span>
            </div>
            <small>{p.pago.after}</small>
          </div>
          <ul>
            {p.pago.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <SmartLink className="mk-btn mk-btn-yellow" {...lojaCta(`Começar teste de ${trialDays} dias`)} />
        </div>
      </div>
      <div className="mk-trial">
        <strong>{p.trialTitle}</strong>
        <div className="mk-trial-steps">
          {trialSteps(trialDays).map((t) => (
            <div key={t.quando}>
              <em>{t.quando}</em>
              <strong>{t.t}</strong>
              <p>{t.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="mk-faq mk-container">
      <h2 className="mk-h2">Dúvidas frequentes</h2>
      <Faq items={landing.faq} />
    </section>
  );
}

export function FinalCta() {
  const f = landing.final;
  return (
    <section className="mk-final">
      <div className="mk-container">
        <h2>{f.title}</h2>
        <div className="mk-ctas">
          <SmartLink className="mk-btn mk-btn-yellow" {...lojaCta(f.ctaLoja)} />
          <SmartLink
            className="mk-btn mk-btn-ghost-light"
            anon={{ href: SIGNUP_PATH, label: f.ctaColecao }}
            authed={{ href: COLLECTION_PATH, label: "Ir para minha coleção" }}
          />
        </div>
      </div>
    </section>
  );
}
