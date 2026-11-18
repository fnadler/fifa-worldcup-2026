"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLotStatus } from "@/app/vendas/pacotes/actions";
import { lotPath, type LotStatus } from "@/lib/packs";
import { formatBRL } from "@/lib/shop";

// Situação do lote e o que dá para fazer em cada uma.
export default function LotStatusPanel({
  lotId,
  status,
  packs,
  priceCents,
  shopSlug,
  lotSlug,
}: {
  lotId: string;
  status: LotStatus;
  packs: number;
  priceCents: number;
  shopSlug: string | null;
  lotSlug: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const path = lotPath(shopSlug, lotSlug);

  function mudar(next: LotStatus) {
    setError(null);
    start(async () => {
      const r = await setLotStatus(lotId, next);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  const resumo = `${packs} ${packs === 1 ? "pacote" : "pacotes"} · ${formatBRL(priceCents)} cada · ${formatBRL(packs * priceCents)} no total`;

  return (
    <div className="pack-status">
      <p className="adm-updated">{resumo}</p>
      {status === "rascunho" && (
        <p className="pack-hint">
          Em rascunho você monta o pote à vontade. Ao colocar à venda, o lote ganha um pacote numerado para cada Legend do pote, e o
          pote fica travado.
        </p>
      )}
      {status === "ativo" && (
        <p className="pack-hint">
          O lote está à venda. Para mexer no pote, pause e volte para rascunho (só é possível enquanto nenhum pacote tiver pedido).
        </p>
      )}
      {status === "pausado" && <p className="pack-hint">O lote está pausado: não aparece para os compradores e não recebe pedidos.</p>}
      {path && (
        <p className="pack-hint">
          Página do lote:{" "}
          <a href={path} target="_blank" rel="noopener noreferrer">
            <b>gncoleciona.com.br{path}</b>
          </a>
          {status !== "ativo" && " (enquanto o lote não estiver à venda, só você vê a página)"}
        </p>
      )}
      {error && <div className="login-error">{error}</div>}
      <div className="auction-form-actions">
        {status === "rascunho" && (
          <button className="btn-primary" onClick={() => mudar("ativo")} disabled={pending || packs === 0}>
            Colocar à venda
          </button>
        )}
        {status === "ativo" && (
          <button className="btn-ghost" onClick={() => mudar("pausado")} disabled={pending}>
            Pausar vendas
          </button>
        )}
        {status === "pausado" && (
          <>
            <button className="btn-primary" onClick={() => mudar("ativo")} disabled={pending}>
              Voltar a vender
            </button>
            <button className="btn-ghost" onClick={() => mudar("rascunho")} disabled={pending}>
              Voltar para rascunho
            </button>
          </>
        )}
      </div>
    </div>
  );
}
