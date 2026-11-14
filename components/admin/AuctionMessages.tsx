"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";

// Mensagens para mandar no grupo antes do leilão, na ordem do dia. Cada uma com botão de copiar.

export interface MessageItem {
  key: string;
  label: string;
  text: string;
}

export default function AuctionMessages({ items }: { items: MessageItem[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copiar(m: MessageItem) {
    const ok = await copyText(m.text);
    setCopied(ok ? m.key : null);
    if (ok) setTimeout(() => setCopied((c) => (c === m.key ? null : c)), 1800);
  }

  return (
    <div className="auction-msgs">
      {items.map((m) => (
        <details key={m.key} className="auction-msg">
          <summary>
            <span>{m.label}</span>
            <button
              type="button"
              className="btn-ghost"
              onClick={(e) => {
                e.preventDefault();
                void copiar(m);
              }}
            >
              {copied === m.key ? "Copiado ✓" : "Copiar"}
            </button>
          </summary>
          <pre className="wa-text">{m.text}</pre>
        </details>
      ))}
    </div>
  );
}
