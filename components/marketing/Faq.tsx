"use client";

import { useState } from "react";

// Acordeão: uma pergunta aberta por vez (a primeira começa aberta).
export default function Faq({ items }: { items: { p: string; r: string }[] }) {
  const [aberta, setAberta] = useState(0);
  return (
    <div className="mk-faq-list">
      {items.map((q, i) => {
        const open = aberta === i;
        return (
          <div key={q.p} className={`mk-faq-item ${open ? "open" : ""}`}>
            <button type="button" aria-expanded={open} aria-controls={`faq-${i}`} onClick={() => setAberta(open ? -1 : i)}>
              <span>{q.p}</span>
              <span className="mk-faq-icon" aria-hidden="true">
                +
              </span>
            </button>
            {open && (
              <div id={`faq-${i}`} role="region" className="mk-faq-answer">
                {q.r}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
