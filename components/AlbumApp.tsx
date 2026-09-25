"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ANCHORAS } from "@/lib/album";
import { deriveBoard } from "@/lib/derive";
import { readLocalQtd, writeLocalQtd } from "@/lib/localBackup";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/lib/useViewMode";
import { CollectionSync, bulkUpsertQtd, fetchRemoteQtd, getPendingSnapshot } from "@/lib/sync";
import type { AppUser, ModoClique, Qtd, StatusFiltro, SyncStatus, TipoFiltro } from "@/lib/types";
import Header from "./Header";
import LegendBar from "./LegendBar";
import AlbumBlockCard from "./AlbumBlockCard";
import TrocasModal from "./TrocasModal";
import BackupModal from "./BackupModal";

interface AlbumAppProps {
  initialUser: AppUser;
  canSell: boolean;
}

export default function AlbumApp({ initialUser, canSell }: AlbumAppProps) {
  const [qtd, setQtd] = useState<Qtd>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [tipo, setTipo] = useState<TipoFiltro>("ALL");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("ALL");
  const [modo, setModo] = useState<ModoClique>("add");
  const [view, setView] = useViewMode("copa2026-album-view");
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
    async (user: AppUser) => {
      const supabase = createClient();
      const sync = new CollectionSync(supabase, user.id, {
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
        const remoteQtd = await fetchRemoteQtd(supabase, user.id);
        let baseline: Qtd;
        if (Object.keys(remoteQtd).length === 0 && Object.keys(localQtd).length > 0) {
          await bulkUpsertQtd(supabase, user.id, localQtd);
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
        showToast("Não foi possível carregar sua coleção do servidor — mostrando dados locais.");
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
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.href = "/login";
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

  async function onSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const derived = useMemo(
    () => deriveBoard(qtd, tipo, statusFiltro, busca),
    [qtd, tipo, statusFiltro, busca]
  );

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
        view={view}
        onView={setView}
        modo={modo}
        onModo={setModo}
        onAbrirTrocas={() => setTrocasAberto(true)}
        onExportar={() => setBackupModo("export")}
        onImportar={() => setBackupModo("import")}
        anchoras={ANCHORAS}
        onAnchorClick={scrollToBlock}
        user={initialUser}
        canSell={canSell}
        onSignOut={onSignOut}
        onToast={showToast}
      />

      <LegendBar
        modo={modo}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        qtdCount={Object.keys(qtd).length}
      />

      <div className="board">
        {derived.visibleBlocks.map((vb) => (
          <AlbumBlockCard key={vb.block.id} vb={vb} modo={modo} onBump={bump} view={view} />
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
