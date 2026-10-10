"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveBoard } from "@/lib/derive";
import { CatalogProvider } from "@/lib/CatalogContext";
import { getCatalog } from "@/lib/catalog";
import { LAST_COLLECTION_COOKIE, type UserCollection } from "@/lib/userCollections";
import { purgeLegacyLocalData, readLocalQtd, writeLocalQtd } from "@/lib/localBackup";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/lib/useViewMode";
import { CollectionSync, fetchRemoteQtd, getPendingSnapshot } from "@/lib/sync";
import type { AppUser, ModoClique, Qtd, StatusFiltro, SyncStatus, TipoFiltro } from "@/lib/types";
import Header from "./Header";
import LegendBar from "./LegendBar";
import AlbumBlockCard from "./AlbumBlockCard";
import ShareModal from "./ShareModal";
import BackupModal from "./BackupModal";
import ShopMatchModal from "./ShopMatchModal";

interface AlbumAppProps {
  initialUser: AppUser;
  shopHref: string;
  shopActive: boolean;
  collectionName: string;
  /** Coleção aberta (albums.id). */
  albumId: string;
  /** Todas as coleções da pessoa — seletor acima do título. */
  collections: UserCollection[];
}

export default function AlbumApp({ initialUser, shopHref, shopActive, collectionName, albumId, collections }: AlbumAppProps) {
  const catalog = getCatalog(albumId);
  const [qtd, setQtd] = useState<Qtd>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [tipo, setTipo] = useState<TipoFiltro>("ALL");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("ALL");
  // Um clique soma; para tirar: clique direito (desktop) ou o "−" do modo Fotos.
  const modo: ModoClique = "add";
  const [view, setView] = useViewMode("copa2026-album-view");
  const [busca, setBusca] = useState("");
  const [trocasAberto, setTrocasAberto] = useState(false);
  const [lojasAberto, setLojasAberto] = useState(false);
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
            writeLocalQtd(user.id, next);
            return next;
          });
          setSyncStatus("error");
          showToast("Não foi possível salvar essa marcação — tente novamente.");
        },
      });
      syncRef.current = sync;

      purgeLegacyLocalData();
      try {
        // O servidor é a fonte da verdade. A cópia local só é usada se o servidor não responder
        // (catch abaixo) — nunca é enviada ao servidor, para não ressuscitar/misturar coleções.
        const baseline = await fetchRemoteQtd(supabase, user.id);
        lastConfirmedQtdRef.current = baseline;

        const pending = getPendingSnapshot(user.id);
        const merged: Qtd = { ...baseline, ...pending };
        Object.keys(merged).forEach((code) => {
          if (merged[code] <= 0) delete merged[code];
        });
        setQtd(merged);
        writeLocalQtd(user.id, merged);
        setSyncStatus("synced");
        setLastSyncedAt(new Date());
        void sync.flushPending();
      } catch {
        lastConfirmedQtdRef.current = {};
        setQtd(readLocalQtd(user.id));
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
      writeLocalQtd(initialUser.id, updated);
      syncRef.current?.schedule(code, next);
      return updated;
    });
  }, [initialUser.id]);

  const restoreFromBackup = useCallback((novo: Qtd) => {
    setQtd(novo);
    writeLocalQtd(initialUser.id, novo);
    Object.entries(novo).forEach(([code, value]) => {
      if (value > 0) syncRef.current?.schedule(code, value);
    });
  }, [initialUser.id]);

  // /colecao volta para a última coleção aberta.
  useEffect(() => {
    document.cookie = `${LAST_COLLECTION_COOKIE}=${catalog.slug}; path=/; max-age=31536000; samesite=lax`;
  }, [catalog.slug]);

  const derived = useMemo(
    () => deriveBoard(catalog, qtd, tipo, statusFiltro, busca),
    [catalog, qtd, tipo, statusFiltro, busca]
  );

  const temItens = useMemo(() => catalog.blocks.some((b) => b.codes.some((c) => (qtd[c] ?? 0) > 0)), [catalog, qtd]);

  // "Quero completar" só faz sentido com a coleção começada e ainda incompleta.
  const podeCompletar = temItens && derived.totFaltam > 0;

  function scrollToBlock(id: string) {
    const el = document.getElementById(`bl-${id}`);
    if (!el || !headerRef.current) return;
    const offset = headerRef.current.getBoundingClientRect().height + 12;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <CatalogProvider value={catalog}>
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
        onCompartilhar={() => setTrocasAberto(true)}
        onAbrirLojas={podeCompletar ? () => setLojasAberto(true) : undefined}
        onExportar={() => setBackupModo("export")}
        onImportar={() => setBackupModo("import")}
        onAnchorClick={scrollToBlock}
        user={initialUser}
        shopHref={shopHref}
        shopActive={shopActive}
        collectionName={collectionName}
        collections={collections}
        onClearFilters={() => {
          setBusca("");
          setTipo("ALL");
          setStatusFiltro("ALL");
        }}
      />

      <LegendBar
        modo={modo}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        qtdCount={catalog.blocks.reduce((s, b) => s + b.codes.filter((c) => qtd[c] !== undefined).length, 0)}
      />

      <div className="board">
        {derived.visibleBlocks.map((vb) => (
          <AlbumBlockCard key={vb.block.id} vb={vb} modo={modo} onBump={bump} view={view} />
        ))}
        {derived.visibleBlocks.length === 0 && (
          <div className="empty-message">Nenhum{catalog.itemSingular === "figurinha" ? "a" : ""} {catalog.itemSingular} com esses filtros.</div>
        )}
      </div>

      {trocasAberto && (
        <ShareModal repetidas={derived.listaTrocas} faltantes={derived.listaFaltantes} onClose={() => setTrocasAberto(false)} />
      )}

      {lojasAberto && <ShopMatchModal onClose={() => setLojasAberto(false)} />}

      {backupModo && (
        <BackupModal
          mode={backupModo}
          qtd={qtd}
          onClose={() => setBackupModo(null)}
          onRestore={restoreFromBackup}
        />
      )}

      {/* celular: "Quero completar" fixo no rodapé (fora do cabeçalho, que tem backdrop-filter) */}
      {podeCompletar && (
        <button type="button" className="btn-primary completar-fixed" onClick={() => setLojasAberto(true)}>
          Quero completar
        </button>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
    </CatalogProvider>
  );
}
