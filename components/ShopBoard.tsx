"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { anchorId, hasNamedStickers } from "@/lib/album";
import { CatalogProvider } from "@/lib/CatalogContext";
import { getCatalog } from "@/lib/catalog";
import { matchesSticker } from "@/lib/derive";
import { formatBRL, priceFor, type CartHold, type ShopPricing } from "@/lib/shop";
import { useCartHold } from "@/lib/useCartHold";
import type { Qtd, TipoFiltro } from "@/lib/types";
import { VIEW_OPTIONS, useViewMode } from "@/lib/useViewMode";
import { CopyLinkButton, FiltersFooter, HeaderActions, NavSwitch, ViewToggleButton } from "./HeaderIcons";
import GroupMenu from "./GroupMenu";
import ShopCell from "./ShopCell";
import UserMenu from "./UserMenu";
import StickerPreview from "./StickerPreview";
import CartModal, { type CartLine } from "./CartModal";
import BrandLogo from "./BrandLogo";
import LogoPreview from "./LogoPreview";
import HoldTimer from "./HoldTimer";
import { PLATFORM_NAME } from "@/lib/brand";

interface ShopBoardProps {
  /** Coleção exibida (albums.id) — um carrinho por coleção. */
  albumId: string;
  /** Coleções à venda na loja (abas quando há mais de uma). */
  albums: { albumId: string; slug: string; name: string }[];
  token: string;
  /** Caminho público da loja (/slug ou /loja/token). */
  path: string;
  shopName: string;
  logoUrl: string | null;
  /** Configuração da loja: mostrar só o que está à venda (sem o filtro de disponibilidade). */
  onlyAvailable: boolean;
  minOrderCents: number;
  available: Qtd;
  pricing: ShopPricing;
  /** Reserva ativa do carrinho deste navegador (cookie), se houver. */
  initialHold: CartHold | null;
  /** Preenchido só quando o dono da loja está vendo a própria vitrine. */
  owner: { email: string | null; paused: boolean } | null;
}

type DispFiltro = "ALL" | "AVAIL";

const DISPS: { value: DispFiltro; label: string }[] = [
  { value: "ALL", label: "Catálogo completo" },
  { value: "AVAIL", label: "Só disponíveis" },
];

export default function ShopBoard({
  albumId,
  albums,
  token,
  path,
  shopName,
  logoUrl,
  onlyAvailable,
  minOrderCents,
  available,
  pricing,
  initialHold,
  owner,
}: ShopBoardProps) {
  const catalog = getCatalog(albumId);
  const itens = (n: number) => `${n} ${n === 1 ? catalog.itemSingular : catalog.itemPlural}`;
  const [tipo, setTipo] = useState<TipoFiltro>("ALL");
  const [dispEscolhido, setDisp] = useState<DispFiltro>("ALL");
  const disp: DispFiltro = onlyAvailable ? "AVAIL" : dispEscolhido;
  const [busca, setBusca] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  const [cartAberto, setCartAberto] = useState(false);
  const [view, changeView] = useViewMode("copa2026-shop-view");
  const [preview, setPreview] = useState<string | null>(null);
  const [logoAberto, setLogoAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((current) => (current === msg ? null : current)), 4000);
  }, []);

  const vendavel = useCallback(
    (code: string) => priceFor(code, pricing) !== null && (available[code] ?? 0) > 0,
    [pricing, available]
  );

  // Carrinho com reserva de 10 min no servidor (ver useCartHold).
  const { cart, expiresAt, changeQty, remove, clear, flush, resetAfterOrder } = useCartHold({
    token,
    albumId,
    available,
    initialHold,
    onToast: showToast,
  });

  const lines: CartLine[] = useMemo(() => {
    const out: CartLine[] = [];
    catalog.blocks.forEach((b) =>
      b.codes.forEach((code) => {
        const qty = cart[code];
        const unit = priceFor(code, pricing);
        if (qty && unit !== null) out.push({ code, qty, available: available[code] ?? 0, unitCents: unit });
      })
    );
    return out;
  }, [catalog, cart, pricing, available]);

  const totalCents = lines.reduce((s, l) => s + l.qty * l.unitCents, 0);
  const totalFigurinhas = lines.reduce((s, l) => s + l.qty, 0);

  const totalDisponivel = useMemo(
    () =>
      catalog.blocks.reduce(
        (s, b) => s + b.codes.reduce((t, code) => t + (vendavel(code) ? available[code] : 0), 0),
        0
      ),
    [catalog, available, vendavel]
  );

  const blocosComVenda = useMemo(
    () => new Set(catalog.blocks.filter((b) => b.codes.some(vendavel)).map((b) => b.id)),
    [catalog, vendavel]
  );
  const tiposVisiveis = useMemo(() => {
    if (!onlyAvailable) return catalog.filters;
    const comVenda = new Set(catalog.blocks.filter((b) => blocosComVenda.has(b.id)).map((b) => b.tipo));
    const filtrados = catalog.filters.filter((t) => t.value === "ALL" || comVenda.has(t.value));
    // com um tipo só, "Todas" já mostra tudo — o filtro não acrescenta nada
    return filtrados.length <= 2 ? [] : filtrados;
  }, [catalog, onlyAvailable, blocosComVenda]);

  const visibleBlocks = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return catalog.blocks.flatMap((b) => {
      if (tipo !== "ALL" && tipo !== b.tipo) return [];
      const matchBloco =
        !buscaLower || b.nome.toLowerCase().includes(buscaLower) || b.id.toLowerCase().includes(buscaLower);
      const codes = b.codes.filter((code) => {
        if (disp === "AVAIL" && !vendavel(code)) return false;
        if (buscaLower && !matchBloco && !matchesSticker(code, buscaLower)) return false;
        return true;
      });
      if (!codes.length) return [];
      const disponiveis = b.codes.filter(vendavel).length;
      return [{ block: b, codes, disponiveis }];
    });
  }, [catalog, busca, tipo, disp, vendavel]);

  // Ordem de navegação da ampliação = o que está visível com os filtros atuais.
  const visibleCodes = useMemo(() => visibleBlocks.flatMap((vb) => vb.codes), [visibleBlocks]);
  const previewIndex = preview ? visibleCodes.indexOf(preview) : -1;

  function scrollToBlock(id: string) {
    setMenuAberto(false);
    const el = document.getElementById(`bl-${id}`);
    if (!el || !headerRef.current) return;
    const offset = headerRef.current.getBoundingClientRect().height + 12;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <CatalogProvider value={catalog}>
    <div className="app-shell has-cart-bar">
      <div className="header" ref={headerRef}>
        <div className="header-inner">
          <div className="header-main-row">
            <div className="brand">
              {logoUrl ? (
                <button type="button" className="brand-logo-button" onClick={() => setLogoAberto(true)} aria-label="Ver logo da loja">
                  <BrandLogo src={logoUrl} />
                </button>
              ) : (
                <BrandLogo />
              )}
              <span className="kicker">{PLATFORM_NAME}</span>
              <span className="title">{shopName}</span>
            </div>

            <div className="totals-row shop-totals">
              <div className="total-card">
                <span className="total-value" style={{ color: "var(--positive)" }}>
                  {totalDisponivel}
                </span>
                <span className="total-label">À venda</span>
              </div>
              {minOrderCents > 0 && (
                <div className="total-card">
                  <span className="total-value" style={{ color: "var(--text-2)" }}>
                    {formatBRL(minOrderCents)}
                  </span>
                  <span className="total-label">Pedido mínimo</span>
                </div>
              )}
            </div>

            <ViewToggleButton view={view} onChange={changeView} />

            <button
              type="button"
              className="btn-ghost mobile-menu-button"
              onClick={() => setMenuAberto((v) => !v)}
            >
              Filtros
            </button>

            {owner && (
              <HeaderActions>
                <NavSwitch active="shop" shopHref={path} />
                <CopyLinkButton
                  text="Copiar link"
                  label="Copiar link da loja"
                  url={() => Promise.resolve(window.location.href.split("#")[0])}
                  successMessage="Link da loja copiado!"
                  onToast={showToast}
                />
                <UserMenu email={owner.email} shopActive />
              </HeaderActions>
            )}

            <button type="button" className="btn-primary cart-button" onClick={() => setCartAberto(true)}>
              Carrinho
              {totalFigurinhas > 0 && <span className="cart-button-count">{totalFigurinhas}</span>}
            </button>
          </div>

          {albums.length > 1 && (
            <nav className="segmented shop-album-tabs" aria-label="Coleções à venda">
              {albums.map((a) => (
                <Link
                  key={a.albumId}
                  href={`${path}?colecao=${a.slug}`}
                  className={`chip ${a.albumId === albumId ? "active" : ""}`}
                  aria-current={a.albumId === albumId ? "page" : undefined}
                >
                  {a.name}
                </Link>
              ))}
            </nav>
          )}

          <div className={`filters-panel ${menuAberto ? "is-open" : ""}`}>
            <button
              type="button"
              className="modal-close filters-panel-close"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar filtros"
            >
              ×
            </button>

            <div className="controls-row">
              <input
                type="search"
                placeholder={catalog.searchPlaceholder}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="search-input"
              />
              {tiposVisiveis.length > 0 && (
              <div className="segmented">
                {tiposVisiveis.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`chip ${tipo === t.value ? "active" : ""}`}
                    onClick={() => setTipo(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              )}
              <div className="segmented view-segment">
                {VIEW_OPTIONS.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className={`chip ${view === v.value ? "active" : ""}`}
                    onClick={() => changeView(v.value)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              {!onlyAvailable && (
              <div className="segmented">
                {DISPS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={`chip ${disp === d.value ? "active" : ""}`}
                    onClick={() => setDisp(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              )}
              <GroupMenu onSelect={scrollToBlock} onlyIds={onlyAvailable ? blocosComVenda : undefined} />
            </div>

            <FiltersFooter
              onClear={() => {
                setBusca("");
                setTipo("ALL");
                setDisp("ALL");
              }}
              onApply={() => {
                setMenuAberto(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </div>
        </div>
      </div>

      {owner?.paused && (
        <div className="owner-banner">
          <strong>Loja pausada.</strong> Só você está vendo esta página — compradores veem “loja pausada”.{" "}
          <Link href="/vendas">Abrir a loja nas configurações</Link>
        </div>
      )}

      <div className="legend-bar">
        <span className="legend-label">Legenda</span>
        <span className="legend-item">
          <i className="legend-swatch swatch-avail" />
          disponível
        </span>
        <span className="legend-item">
          <i className="legend-swatch swatch-dup" />
          no carrinho
        </span>
        <span className="legend-item">
          <i className="legend-swatch swatch-empty" />
          indisponível
        </span>
        <span className="legend-hint">
          {view === "photos"
            ? "Toque na foto para ampliar · use + para adicionar ao carrinho"
            : "Clique para adicionar ao carrinho · clique direito remove uma unidade"}
        </span>
      </div>

      <div className="board">
        {visibleBlocks.map(({ block, codes, disponiveis }) => (
          <div key={block.id} id={anchorId(block)} className="block-card">
            <div className="block-header">
              <span className={`block-tag ${catalog.isSpecial(block) ? "block-tag-special" : ""}`}>
                {catalog.blockTag(block)}
              </span>
              <span className="block-name">{block.nome}</span>
              <span className="block-code-range">{catalog.blockRange(block)}</span>
              <div className="block-header-spacer" />
              <span className="block-summary-coladas">
                {disponiveis} de {block.codes.length} à venda
              </span>
            </div>
            <div
              className={`cell-grid ${
                view === "photos" ? "shop-photo-grid" : `shop-grid ${hasNamedStickers(block) ? "cell-grid-named" : ""}`
              }`}
            >
              {codes.map((code) => (
                <ShopCell
                  key={code}
                  code={code}
                  price={priceFor(code, pricing)}
                  available={available[code] ?? 0}
                  inCart={cart[code] ?? 0}
                  view={view}
                  onChange={changeQty}
                  onPreview={setPreview}
                />
              ))}
            </div>
          </div>
        ))}
        {visibleBlocks.length === 0 && (
          <div className="empty-message">
            Nenhum{catalog.itemSingular === "figurinha" ? "a" : ""} {catalog.itemSingular} com esses filtros.
          </div>
        )}
      </div>

      {totalFigurinhas > 0 && !cartAberto && !preview && (
        <button type="button" className="cart-float cart-float-desktop" onClick={() => setCartAberto(true)}>
          <span>
            {itens(totalFigurinhas)} · <strong>{formatBRL(totalCents)}</strong>
          </span>
          <HoldTimer expiresAt={expiresAt} variant="compact" />
          <span className="cart-float-cta">Ver carrinho →</span>
        </button>
      )}

      {/* Celular: carrinho fixo no rodapé, sempre visível, com o aviso do pedido mínimo. */}
      {!cartAberto && !preview && !menuAberto && (
        <div className="cart-bar">
          <div className="cart-bar-info">
            <strong>
              {totalFigurinhas === 0
                ? "Seu carrinho está vazio"
                : `${itens(totalFigurinhas)} · ${formatBRL(totalCents)}`}
            </strong>
            {minOrderCents > 0 ? (
              totalCents >= minOrderCents ? (
                <span className="cart-bar-note is-ok">Pedido mínimo atingido ✓</span>
              ) : (
                <span className="cart-bar-note">
                  Pedido mínimo {formatBRL(minOrderCents)} · faltam {formatBRL(minOrderCents - totalCents)}
                </span>
              )
            ) : (
              totalFigurinhas === 0 && <span className="cart-bar-note">Toque em + para adicionar {catalog.itemPlural}</span>
            )}
            {totalFigurinhas > 0 && <HoldTimer expiresAt={expiresAt} variant="compact" />}
          </div>
          <button type="button" className="btn-primary" onClick={() => setCartAberto(true)}>
            Carrinho{totalFigurinhas > 0 ? ` (${totalFigurinhas})` : ""}
          </button>
        </div>
      )}

      {logoAberto && logoUrl && <LogoPreview src={logoUrl} name={shopName} onClose={() => setLogoAberto(false)} />}

      {preview && (
        <StickerPreview
          code={preview}
          price={priceFor(preview, pricing)}
          available={available[preview] ?? 0}
          inCart={cart[preview] ?? 0}
          onChange={changeQty}
          onPrev={previewIndex > 0 ? () => setPreview(visibleCodes[previewIndex - 1]) : null}
          onNext={
            previewIndex >= 0 && previewIndex < visibleCodes.length - 1
              ? () => setPreview(visibleCodes[previewIndex + 1])
              : null
          }
          onClose={() => setPreview(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      {cartAberto && (
        <CartModal
          token={token}
          albumId={albumId}
          lines={lines}
          totalCents={totalCents}
          minOrderCents={minOrderCents}
          expiresAt={expiresAt}
          onChange={changeQty}
          onRemove={remove}
          onClear={clear}
          onReview={flush}
          onOrdered={resetAfterOrder}
          onClose={() => setCartAberto(false)}
        />
      )}
    </div>
    </CatalogProvider>
  );
}
