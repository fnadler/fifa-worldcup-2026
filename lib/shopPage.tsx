import "server-only";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DEFAULT_SHOP_NAME, PLATFORM_NAME } from "@/lib/brand";
import { CART_COOKIE, readCartId } from "@/lib/cartCookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTS_TAB, availableFromQty, groupsOf, productsPricing, shopPath, type ShopRow } from "@/lib/shop";
import { loadShopAlbums } from "@/lib/shopAlbums";
import { loadShopProducts } from "@/lib/shopProducts";
import { DEFAULT_CATALOG, catalogBySlug, getCatalog } from "@/lib/catalog";
import { hasShopAccess } from "@/lib/shopAccess";
import NoticeCard from "@/components/NoticeCard";
import ShopBoard from "@/components/ShopBoard";
import type { Qtd } from "@/lib/types";
import { fetchAll } from "@/lib/fetchAll";

// Página pública da loja, compartilhada por /<slug> (endereço amigável) e /loja/<token>
// (link permanente antigo, que redireciona para o slug quando ele existe).

type ShopLookup = { slug: string } | { token: string };

const SHOP_COLUMNS =
  "user_id, token, slug, logo_url, only_available, enabled, seller_name, whatsapp, order_min_cents";

async function findShop(where: ShopLookup) {
  const admin = createAdminClient();
  const query = admin.from("shops").select(SHOP_COLUMNS);
  const { data } = await ("slug" in where ? query.eq("slug", where.slug) : query.eq("token", where.token)).maybeSingle<
    ShopRow & { user_id: string }
  >();
  return data;
}

export async function shopMetadata(where: ShopLookup): Promise<Metadata> {
  const shop = await findShop(where);
  const nome = shop?.seller_name || DEFAULT_SHOP_NAME;
  return {
    title: `${nome} — ${PLATFORM_NAME}`,
    description: `Figurinhas, cards avulsos e produtos à venda na loja ${nome}.`,
  };
}

/** `colecao`: aba pedida na URL — endereço de uma coleção (?colecao=adrenalyn-xl) ou "produtos". */
export async function renderShop(where: ShopLookup, colecao?: string) {
  const admin = createAdminClient();
  const shop = await findShop(where);

  if (!shop) notFound();
  // Link antigo por token: leva ao endereço amigável quando a loja já tem um.
  if ("token" in where && shop.slug) redirect(shopPath(shop));
  const token = shop.token;

  // Quem está vendo é o dono? Ele ganha os atalhos (álbum, configurações, link, conta)
  // e consegue ver a própria loja mesmo pausada.
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const isOwner = user?.id === shop.user_id;

  // Acesso à vitrine vencido/revogado, ou loja pausada para quem não é o dono.
  const hasAccess = await hasShopAccess(admin, shop.user_id);
  if (!hasAccess || (!shop.enabled && !isOwner)) {
    return (
      <NoticeCard kicker="Loja pausada" title={shop.seller_name || DEFAULT_SHOP_NAME}>
        Esta loja não está recebendo pedidos no momento. Volte mais tarde!
      </NoticeCard>
    );
  }

  // Coleções à venda (na ordem da plataforma) e produtos ativos. A aba é a da URL, se existir;
  // senão a primeira coleção — ou os produtos, numa loja que só vende produtos.
  const [albums, products] = await Promise.all([loadShopAlbums(admin, shop.user_id), loadShopProducts(admin, shop.user_id, true)]);
  const aVenda = albums.filter((a) => a.enabled);
  if (!aVenda.length && !products.length) {
    return (
      <NoticeCard kicker="Loja" title={shop.seller_name || DEFAULT_SHOP_NAME}>
        Esta loja não tem itens à venda no momento. Volte mais tarde!
      </NoticeCard>
    );
  }
  const pedida = colecao && colecao !== PRODUCTS_TAB ? catalogBySlug(colecao)?.id : undefined;
  const atual = aVenda.find((a) => a.albumId === pedida) ?? aVenda[0];
  const tab = products.length && (colecao === PRODUCTS_TAB || !atual) ? "products" : "album";

  await admin.rpc("expire_orders", { p_seller: shop.user_id });

  const cartId = readCartId((await cookies()).get(CART_COOKIE)?.value);

  const [{ data: rows }, { data: priceRows }, { data: reservedRows }, { data: holds }] = await Promise.all([
    // só repetidas (qty > 1) interessam à loja
    fetchAll<{ code: string; qty: number }>((from, to) =>
      admin.from("collection").select("code, qty").eq("user_id", shop.user_id).gt("qty", 1).order("code").range(from, to)
    ),
    fetchAll<{ code: string; price_cents: number }>((from, to) =>
      admin.from("sticker_prices").select("code, price_cents").eq("user_id", shop.user_id).order("code").range(from, to)
    ),
    // reservas de pedidos + carrinhos de OUTRAS pessoas (o deste navegador não desconta dele)
    admin.rpc("reserved_qty", { p_seller: shop.user_id, p_exclude_cart: cartId }),
    // o carrinho deste navegador nesta loja (um só; linhas antigas, por coleção, são somadas)
    cartId
      ? admin
          .from("cart_holds")
          .select("items, expires_at")
          .eq("cart_id", cartId)
          .eq("seller_id", shop.user_id)
          .gt("expires_at", new Date().toISOString())
          .returns<{ items: { code: string; qty: number }[]; expires_at: string }[]>()
      : Promise.resolve({ data: null }),
  ]);

  const reserved = new Map(
    ((reservedRows ?? []) as { code: string; qty: number }[]).map((r) => [r.code, r.qty])
  );

  // Só a disponibilidade vai para o cliente — nunca o qty bruto nem o WhatsApp do anunciante.
  // Disponível = estoque (repetidas / estoque do produto) menos o que está reservado em pedidos
  // ainda não confirmados e em carrinhos ativos de outros compradores.
  const available: Qtd = {};
  (rows ?? []).forEach((row) => {
    const n = availableFromQty(row.qty as number) - (reserved.get(row.code as string) ?? 0);
    if (n > 0) available[row.code as string] = n;
  });
  products.forEach((p) => {
    const n = p.stock - (reserved.get(p.code) ?? 0);
    if (n > 0) available[p.code] = n;
  });

  const individual: Record<string, number> = {};
  (priceRows ?? []).forEach((row) => {
    individual[row.code as string] = row.price_cents as number;
  });

  const ownHold = holds?.length
    ? {
        items: holds.flatMap((h) => h.items),
        expiresAt: holds.map((h) => h.expires_at).sort().at(-1)!,
      }
    : null;

  return (
    <ShopBoard
      key={tab === "products" ? PRODUCTS_TAB : atual.albumId}
      tab={tab}
      albumId={atual?.albumId ?? DEFAULT_CATALOG.id}
      albums={aVenda.map((a) => {
        const c = getCatalog(a.albumId);
        return { albumId: c.id, slug: c.slug, name: c.name };
      })}
      products={products.map((p) => ({ code: p.code, title: p.title, description: p.description, priceCents: p.priceCents, imageUrl: p.imageUrl }))}
      token={token}
      path={shopPath(shop)}
      shopName={shop.seller_name || DEFAULT_SHOP_NAME}
      logoUrl={shop.logo_url ?? null}
      onlyAvailable={shop.only_available ?? false}
      minOrderCents={shop.order_min_cents ?? 0}
      available={available}
      pricing={{ groups: groupsOf(aVenda), individual, products: productsPricing(products) }}
      initialHold={ownHold}
      owner={isOwner ? { email: user?.email ?? null, paused: !shop.enabled } : null}
    />
  );
}
