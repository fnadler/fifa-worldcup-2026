import { COMPANY, LEGAL_UPDATED, type LegalDoc } from "@/content/legal";
import MarketingFooter from "./MarketingFooter";
import MarketingNav from "./MarketingNav";

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <header className="mk-legal-top">
        <MarketingNav anchorsBase="/" />
      </header>
      <main className="mk-legal mk-container">
        <h1>{doc.title}</h1>
        <span className="mk-legal-meta">
          Última atualização: {LEGAL_UPDATED} · {COMPANY.marca}
        </span>
        {doc.intro.map((p) => (
          <p key={p}>{p}</p>
        ))}
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {s.ul && (
              <ul>
                {s.ul.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </main>
      <MarketingFooter />
    </>
  );
}
