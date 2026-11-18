"use client";

import { useState } from "react";
import { COLLECTION_PATH, signupThen } from "@/lib/routes";

// Guardar as figurinhas dos pacotes abertos na coleção do comprador (uma vez por pacote). Sem conta,
// convida a criar uma (ou entrar) e volta para a página dos pacotes.

export default function CollectCard({
  token,
  viewer,
  pending,
  done,
  onCollected,
}: {
  token: string;
  viewer: "anon" | "buyer" | "other";
  /** Figurinhas de pacotes abertos que ainda não foram marcadas. */
  pending: number;
  /** Já marcou alguma vez (ou todas). */
  done: boolean;
  onCollected: (added: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const back = `/pacote/${token}`;

  if (pending === 0) {
    if (!done) return null;
    return (
      <div className="lotp-collect is-done">
        <span>✓ As figurinhas dos pacotes abertos já estão na sua coleção.</span>
        <a href={COLLECTION_PATH} className="lotp-btn lotp-btn-ghost lotp-small">
          Ver minha coleção
        </a>
      </div>
    );
  }

  async function marcar() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/pacote/${token}/colecao`, { method: "POST" });
      const data = (await res.json()) as { added?: number; error?: string };
      if (!res.ok) return setMsg(data.error ?? "Não foi possível guardar as figurinhas — tente de novo.");
      onCollected(data.added ?? 0);
    } catch {
      setMsg("Sem conexão — tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lotp-collect">
      <div>
        <b>Guarde na sua coleção</b>
        <p>
          {viewer === "anon"
            ? `Crie sua conta grátis na GN Coleciona para marcar estas ${pending} figurinhas no seu álbum da Copa 2026 e ver o que ainda falta.`
            : viewer === "other"
              ? "Você entrou com outra conta. Entre com a conta do e-mail usado no pedido para guardar as figurinhas."
              : `Marque as ${pending} figurinhas dos pacotes abertos no seu álbum da Copa 2026.`}
        </p>
        {msg && <p className="lotp-collect-error">{msg}</p>}
      </div>
      <div className="lotp-collect-actions">
        {viewer === "buyer" && (
          <button className="lotp-btn lotp-btn-green" onClick={() => void marcar()} disabled={busy}>
            {busy ? "Guardando…" : "Marcar na minha coleção"}
          </button>
        )}
        {viewer === "anon" && (
          <>
            <a className="lotp-btn lotp-btn-green" href={signupThen(back)}>
              Criar conta grátis
            </a>
            <a className="lotp-btn lotp-btn-ghost" href={`/login?next=${encodeURIComponent(back)}`}>
              Já tenho conta
            </a>
          </>
        )}
      </div>
    </div>
  );
}
