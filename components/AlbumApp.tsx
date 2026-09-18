"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BLOCKS, TOTAL_STICKERS, blockTag, codigoBase } from "@/lib/album";
import { readLocalQtd, writeLocalQtd } from "@/lib/localBackup";
import { createClient } from "@/lib/supabase/client";
import { CollectionSync, bulkUpsertQtd, fetchRemoteQtd, getPendingSnapshot } from "@/lib/sync";
import type {
  Anchor,
  AppUser,
  ModoClique,
  Qtd,
  StatusFiltro,
  SyncStatus,
  TipoFiltro,
  VisibleBlock,
} from "@/lib/types";
import Header from "./Header";
import LegendBar from "./LegendBar";
import AlbumBlockCard from "./AlbumBlockCard";
import TrocasModal from "./TrocasModal";
import BackupModal from "./BackupModal";

const ANCHORAS: Anchor[] = BLOCKS.map((b) => ({
  id: b.id,
  label: b.tipo === "TEAM" ? `${b.grupo} · ${b.id}` : b.tipo === "FWC" ? "FWC" : "COCA-COLA",
  title: b.nome,
  variant: b.tipo === "TEAM" ? "team" : b.tipo === "FWC" ? "fwc" : "cc",
}));

interface AlbumAppProps {
  initialUser: AppUser | null;
}

export default function AlbumApp({ initialUser }: AlbumAppProps) {
  const [qtd, setQtd] = useState<Qtd>({});
  const [user, setUser] = useState<AppUser | null>(initialUser);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [tipo, setTipo] = useState<TipoFiltro>("ALL");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("ALL");
  const [modo, setModo] = useState<ModoClique>("add");
  const [busca, setBusca] = useState("");
  const [trocasAberto, setTrocasAberto] = useState(false);
  const [backupModo, setBackupModo] = useState<"export" | "import" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const syncRef = useRef<CollectionSync | null>(null);
  const lastConfirmedQtdRef = useRef<Qtd>({});

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((current) => (current === msg ? null : current)), 4000);
  }, []);

  const loadForUser = useCallback(
    async (nextUser: AppUser | null) => {
      setUser(nextUser);

      if (!nextUser) {
        syncRef.current = null;
        lastConfirmedQtdRef.current = {};
        setQtd(readLocalQtd());
        setSyncStatus("idle");
        setLastSyncedAt(null);
        return;
      }

      const supabase = createClient();
      const sync = new CollectionSync(supabase, nextUser.id, {
        onSaving: () => setSyncStatus("saving"),
        onSynced: (code, qty2) => {
          lastConfirmedQtdRef.current = { ...lastConfirmedQtdRef.current };
          if (qty2 <= 0) delete lastConfirmedQtdRef.current[code];
          else lastConfirmedQtdRef.current[code] = qty2;
          setSyncStatus("synced");
          setLastSyncedAt(new Date());
        },
        onOffline: () => setSyncStatus("offline"),
        onError: (code) => {
          const fallback = lastConfirmedQtdRef.current[code] ?? 0;
          setQtd((prev) => {
            const next = { ...prev };
            if (fallback <= 0) delete next[code];
            else next[code] = fallback;
            writeLocalQtd(next);
            return next;
          });
          setSyncStatus("error");
          showToast("Não foi possível salvar essa marcação — tente novamente.");
        },
      });
      syncRef.current = sync;

      try {
        const localQtd = readLocalQtd();
        const remoteQtd = await fetchRemoteQtd(supabase, nextUser.id);
        let baseline: Qtd;
        if (Object.keys(remoteQtd).length === 0 && Object.keys(localQtd).length > 0) {
          await bulkUpsertQtd(supabase, nextUser.id, localQtd);
          baseline = localQtd;
        } else {
          baseline = remoteQtd;
        }
        lastConfirmedQtdRef.current = baseline;

        const pending = getPendingSnapshot();
        const merged: Qtd = { ...baseline, ...pending };
        Object.keys(merged).forEach((code) => {
          if (merged[code] <= 0) delete merged[code];
        });
        setQtd(merged);
        writeLocalQtd(merged);
        setSyncStatus("synced");
        setLastSyncedAt(new Date());
        void sync.flushPending();
      } catch {
        lastConfirmedQtdRef.current = {};
        setQtd(readLocalQtd());
        setSyncStatus("error");
      }
    },
    [showToast]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadForUser(initialUser);
    });

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        void loadForUser({ id: session.user.id, email: session.user.email ?? null });
      } else if (event === "SIGNED_OUT") {
        void loadForUser(null);
      }
    });

    function onOnline() {
      void syncRef.current?.flushPending();
    }
    window.addEventListener("online", onOnline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bump = useCallback((code: string, delta: number) => {
    setQtd((prev) => {
      const current = prev[code] ?? 0;
      const next = Math.max(0, Math.min(99, current + delta));
      const updated = { ...prev };
      if (next === 0) delete updated[code];
      else updated[code] = next;
      writeLocalQtd(updated);
      syncRef.current?.schedule(code, next);
      return updated;
    });
  }, []);

  const restoreFromBackup = useCallback((novo: Qtd) => {
    setQtd(novo);
    writeLocalQtd(novo);
    Object.entries(novo).forEach(([code, value]) => {
      if (value > 0) syncRef.current?.schedule(code, value);
    });
  }, []);

  async function onSignIn(email: string): Promise<{ error: string | null }> {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error ? error.message : null };
  }

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  const derived = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    let totColadas = 0;
    let totRepetidas = 0;

    BLOCKS.forEach((b) => {
      b.codes.forEach((code) => {
        const n = qtd[code] ?? 0;
        if (n >= 1) totColadas++;
        if (n > 1) totRepetidas += n - 1;
      });
    });

    const visibleBlocks: VisibleBlock[] = [];
    BLOCKS.forEach((b) => {
      if (tipo !== "ALL" && tipo !== b.tipo) return;
      const matchBloco =
        !buscaLower ||
        b.nome.toLowerCase().includes(buscaLower) ||
        b.id.toLowerCase().includes(buscaLower);

      let coladas = 0;
      let repetidas = 0;
      const stickers: { code: string; qty: number }[] = [];

      b.codes.forEach((code) => {
        const n = qtd[code] ?? 0;
        if (n >= 1) coladas++;
        if (n > 1) repetidas += n - 1;

        if (statusFiltro === "REP" && n < 2) return;
        if (statusFiltro === "MISS" && n !== 0) return;
        if (buscaLower && !matchBloco && !code.toLowerCase().includes(buscaLower)) return;

        stickers.push({ code, qty: n });
      });

      if (!stickers.length) return;

      visibleBlocks.push({
        block: b,
        tag: blockTag(b),
        codigoBase: codigoBase(b),
        coladas,
        repetidas,
        pct: Math.round((coladas / b.codes.length) * 100),
        stickers,
      });
    });

    const linhas: string[] = [];
    BLOCKS.forEach((b) => {
      const itens = b.codes
        .filter((c) => (qtd[c] ?? 0) > 1)
        .map((c) => {
          const n = (qtd[c] ?? 0) - 1;
          return n > 1 ? `${c} (x${n})` : c;
        });
      if (itens.length) linhas.push(`${b.nome}: ${itens.join(", ")}`);
    });
    const listaTrocas = linhas.length
      ? `REPETIDAS — ÁLBUM COPA 2026\n\n${linhas.join("\n")}`
      : "Nenhuma repetida registrada ainda.";

    return {
      totColadas,
      totRepetidas,
      totGeral: TOTAL_STICKERS,
      totFaltam: TOTAL_STICKERS - totColadas,
      visibleBlocks,
      listaTrocas,
    };
  }, [qtd, tipo, statusFiltro, busca]);

  function scrollToBlock(id: string) {
    const el = document.getElementById(`bl-${id}`);
    if (!el || !headerRef.current) return;
    const offset = headerRef.current.getBoundingClientRect().height + 12;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <Header
        headerRef={headerRef}
        totColadas={derived.totColadas}
        totGeral={derived.totGeral}
        totRepetidas={derived.totRepetidas}
        totFaltam={derived.totFaltam}
        busca={busca}
        onBusca={setBusca}
        tipo={tipo}
        onTipo={setTipo}
        statusFiltro={statusFiltro}
        onStatusFiltro={setStatusFiltro}
        modo={modo}
        onModo={setModo}
        onAbrirTrocas={() => setTrocasAberto(true)}
        onExportar={() => setBackupModo("export")}
        onImportar={() => setBackupModo("import")}
        anchoras={ANCHORAS}
        onAnchorClick={scrollToBlock}
        user={user}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
      />

      <LegendBar
        modo={modo}
        user={user}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        qtdCount={Object.keys(qtd).length}
      />

      <div className="board">
        {derived.visibleBlocks.map((vb) => (
          <AlbumBlockCard key={vb.block.id} vb={vb} modo={modo} onBump={bump} />
        ))}
        {derived.visibleBlocks.length === 0 && (
          <div className="empty-message">Nenhuma figurinha com esses filtros.</div>
        )}
      </div>

      {trocasAberto && (
        <TrocasModal
          lista={derived.listaTrocas}
          totRepetidas={derived.totRepetidas}
          onClose={() => setTrocasAberto(false)}
        />
      )}

      {backupModo && (
        <BackupModal
          mode={backupModo}
          qtd={qtd}
          onClose={() => setBackupModo(null)}
          onRestore={restoreFromBackup}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
