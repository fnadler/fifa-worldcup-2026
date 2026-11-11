"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveBoard } from "@/lib/derive";
import { CatalogProvider } from "@/lib/CatalogContext";
import { getCatalog } from "@/lib/catalog";
import { LAST_COLLECTION_COOKIE, type UserCollection } from "@/lib/userCollections";
import { purgeLegacyLocalData, readLocalQtd, writeLocalQtd } from "@/lib/localBackup";
import { createClient } from "@/lib/supabase/client";
import { useViewMode } from "@/lib/useViewMode";
import { CollectionSync, bulkApply, bulkRestore, fetchRemoteQtd, getPendingSnapshot, type BulkMode, type BulkResult } from "@/lib/sync";
import type { AppUser, ModoClique, Qtd, StatusFiltro, SyncStatus, TipoFiltro } from "@/lib/types";
import Header from "./Header";
import LegendBar from "./LegendBar";
import AlbumBlockCard from "./AlbumBlockCard";
import ShareModal from "./ShareModal";
import ShopMatchModal from "./ShopMatchModal";
import CommunityBanner from "./CommunityBanner";
import BulkMarkModal from "./BulkMarkModal";

interface AlbumAppProps {
  initialUser: AppUser;
  shopHref: string;
  shopActive: boolean;
  collectionName: string;
  /** Coleção aberta (albums.id). */
  albumId: string;
  /** Todas as coleções da pessoa — seletor acima do título. */
  collections: UserCollection[];
  /** Abre "Lojas com o que falta" ao carregar (?lojas=1, link do e-mail). */
  openShopsOnLoad?: boolean;
}

export default function AlbumApp({ initialUser, shopHref, shopActive, collectionName, albumId, collections, openShopsOnLoad }: AlbumAppProps) {
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
  const [lojasAberto, setLojasAberto] = useState(Boolean(openShopsOnLoad));
  const [toast, setToast] = useState<string | null>(null);
  // Marcação em lote: null = fechado; blockIds = blocos já marcados ao abrir.
  const [lote, setLote] = useState<{ blockIds: string[] } | null>(null);
  // "Desfazer" do último lote — valores de antes, por figurinha.
  const [undo, setUndo] = useState<{ msg: string; codes: string[]; qtys: number[]; busy?: boolean } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const syncRef = useRef<CollectionSync | null>(null);
  const lastConfirmedQtdRef = useRef<Qtd>({});

  // tira o ?lojas=1 da barra de endereço: recarregar ou compartilhar a página não reabre o modal
  useEffect(() => {
    if (!openShopsOnLoad) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("lojas");
    window.history.replaceState(window.history.state, "", url);
  }, [openShopsOnLoad]);

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

  // Grava na tela o que o banco devolveu (fonte da verdade) depois de um lote ou de desfazer um lote.
  const applyServerResult = useCallback(
    (res: BulkResult) => {
      const confirmed = { ...lastConfirmedQtdRef.current };
      res.codes.forEach((code, i) => {
        if (res.new[i] <= 0) delete confirmed[code];
        else confirmed[code] = res.new[i];
      });
      lastConfirmedQtdRef.current = confirmed;
      setQtd((prev) => {
        const next = { ...prev };
        res.codes.forEach((code, i) => {
          if (res.new[i] <= 0) delete next[code];
          else next[code] = res.new[i];
        });
        writeLocalQtd(initialUser.id, next);
        return next;
      });
      setSyncStatus("synced");
      setLastSyncedAt(new Date());
    },
    [initialUser.id]
  );

  const showUndo = useCallback((next: { msg: string; codes: string[]; qtys: number[] } | null) => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndo(next);
    if (next) undoTimerRef.current = window.setTimeout(() => setUndo(null), 12000);
  }, []);

  // Antes de um lote, as marcações individuais pendentes precisam chegar ao servidor (senão chegariam
  // depois e desfariam parte do lote).
  const settleSync = useCallback(async (): Promise<boolean> => {
    const sync = syncRef.current;
    if (!sync) return false;
    setSyncStatus("saving");
    if (await sync.settle()) return true;
    setSyncStatus("offline");
    showToast("Há marcações ainda não salvas — confira a conexão e tente de novo.");
    return false;
  }, [showToast]);

  const applyBulk = useCallback(
    async (codes: string[], mode: BulkMode, n: number, keepHigher: boolean): Promise<boolean> => {
      if (!(await settleSync())) return false;
      try {
        const res = await bulkApply(createClient(), albumId, codes, mode, n, keepHigher);
        applyServerResult(res);
        const total = res.codes.length;
        showUndo(
          total
            ? { msg: `${total} ${total === 1 ? catalog.itemSingular : catalog.itemPlural} atualizad${catalog.itemSingular === "figurinha" ? "a" : "o"}${total === 1 ? "" : "s"}.`, codes: res.codes, qtys: res.old }
            : null
        );
        if (!total) showToast("Nada mudou — já estava tudo assim.");
        return true;
      } catch {
        setSyncStatus("error");
        showToast("Não foi possível aplicar a marcação em lote — nada foi alterado.");
        return false;
      }
    },
    [albumId, applyServerResult, catalog.itemPlural, catalog.itemSingular, settleSync, showToast, showUndo]
  );

  const undoBulk = useCallback(async () => {
    if (!undo || undo.busy) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndo({ ...undo, busy: true });
    if (!(await settleSync())) {
      showUndo(undo);
      return;
    }
    try {
      applyServerResult(await bulkRestore(createClient(), albumId, undo.codes, undo.qtys));
      showUndo(null);
      showToast("Marcação em lote desfeita.");
    } catch {
      setSyncStatus("error");
      showUndo(undo);
      showToast("Não foi possível desfazer — tente de novo.");
    }
  }, [albumId, applyServerResult, settleSync, showToast, showUndo, undo]);

  useEffect(
    () => () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    },
    []
  );

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
        onMarcarLote={() => setLote({ blockIds: [] })}
        onAbrirLojas={podeCompletar ? () => setLojasAberto(true) : undefined}
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

      <CommunityBanner />

      <LegendBar
        modo={modo}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        qtdCount={catalog.blocks.reduce((s, b) => s + b.codes.filter((c) => qtd[c] !== undefined).length, 0)}
      />

      <div className="board">
        {derived.visibleBlocks.map((vb) => (
          <AlbumBlockCard
            key={vb.block.id}
            vb={vb}
            modo={modo}
            onBump={bump}
            view={view}
            onBulk={() => setLote({ blockIds: [vb.block.id] })}
          />
        ))}
        {derived.visibleBlocks.length === 0 && (
          <div className="empty-message">Nenhum{catalog.itemSingular === "figurinha" ? "a" : ""} {catalog.itemSingular} com esses filtros.</div>
        )}
      </div>

      {trocasAberto && (
        <ShareModal repetidas={derived.listaTrocas} faltantes={derived.listaFaltantes} onClose={() => setTrocasAberto(false)} />
      )}

      {lojasAberto && <ShopMatchModal onClose={() => setLojasAberto(false)} />}

      {lote && <BulkMarkModal qtd={qtd} initialBlockIds={lote.blockIds} onApply={applyBulk} onClose={() => setLote(null)} />}

      {/* celular: "Quero completar" fixo no rodapé (fora do cabeçalho, que tem backdrop-filter) */}
      {podeCompletar && (
        <button type="button" className="btn-primary completar-fixed" onClick={() => setLojasAberto(true)}>
          Quero completar
        </button>
      )}

      {undo && !toast && (
        <div className="toast toast-undo" role="status">
          <span>{undo.msg}</span>
          <button type="button" className="toast-action" onClick={undoBulk} disabled={undo.busy}>
            {undo.busy ? "Desfazendo…" : "Desfazer"}
          </button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
    </CatalogProvider>
  );
}
