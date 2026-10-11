import "server-only";
import type { User } from "@supabase/supabase-js";
import { DEFAULT_SHOP_NAME } from "./brand";
import { CATALOGS, lookupCode } from "./catalog";
import { fetchAll } from "./fetchAll";
import { shopPath } from "./shop";
import { createAdminClient } from "./supabase/admin";

// Painel administrativo (/admin): números da plataforma, só leitura. Tudo é lido com a service_role
// (ignora o RLS), por isso a página confere quem está pedindo antes de chamar loadAdminStats.

/** Única conta com acesso ao painel. */
const ADMIN_EMAIL = "fnadler@gmail.com";

export function isAdmin(user: Pick<User, "email" | "email_confirmed_at"> | null): boolean {
  return !!user?.email_confirmed_at && user.email?.toLowerCase() === ADMIN_EMAIL;
}

export type UserKind = "assinante" | "colecionador" | "sem-colecao";

export interface AdminCollection {
  albumId: string;
  name: string;
  total: number;
  /** Itens marcados (ao menos 1 unidade). */
  items: number;
  /** Unidades repetidas (soma do que passa de 1). */
  duplicates: number;
  createdAt: string | null;
}

export interface AdminShop {
  name: string;
  path: string;
  /** Ligada pelo dono (enabled) e com acesso em dia. */
  open: boolean;
  enabled: boolean;
  access: "stripe" | "manual" | null;
  /** Status da assinatura no Stripe (trialing, active, past_due…), se houver. */
  subscription: string | null;
  albums: { name: string; items: number }[];
  /** Itens únicos à venda (códigos com repetida nas coleções à venda) — mesma conta de /lojas. */
  items: number;
  orders: { novo: number; confirmado: number; cancelado: number };
  /** Valor dos pedidos confirmados, em centavos. */
  confirmedCents: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  kind: UserKind;
  collections: AdminCollection[];
  items: number;
  shop: AdminShop | null;
}

export interface AdminStats {
  generatedAt: string;
  users: AdminUser[];
  totals: {
    accounts: number;
    confirmed: number;
    assinantes: number;
    assinantesStripe: number;
    colecionadores: number;
    semColecao: number;
    new7: number;
    new30: number;
    active7: number;
    active30: number;
    collections: number;
    items: number;
    shopsCreated: number;
    shopsOpen: number;
    shopItems: number;
    orders: { novo: number; confirmado: number; cancelado: number };
    confirmedCents: number;
  };
  albums: {
    albumId: string;
    name: string;
    total: number;
    collections: number;
    items: number;
    duplicates: number;
    /** Lojas abertas com esta coleção à venda. */
    shops: number;
    shopItems: number;
  }[];
  /** Um ponto por dia desde a primeira conta: contas novas, coleções novas e os acumulados. */
  series: { day: string; newUsers: number; users: number; newCollections: number; collections: number }[];
}

interface CollectionStat {
  user_id: string;
  album_id: string;
  itens: number;
  repetidas: number;
  itens_repetidos: number;
}

type Admin = ReturnType<typeof createAdminClient>;

// Marcações por conta e coleção. A função do banco agrega tudo numa consulta; sem ela (migração
// supabase_migration_admin_stats.sql ainda não aplicada) lê a tabela inteira e agrega aqui.
async function collectionStats(admin: Admin): Promise<CollectionStat[]> {
  const { data, error } = await admin.rpc("admin_collection_stats");
  if (!error && data) return data as CollectionStat[];

  const { data: rows } = await fetchAll<{ user_id: string; code: string; qty: number }>((from, to) =>
    admin.from("collection").select("user_id, code, qty").gt("qty", 0).order("user_id").order("code").range(from, to)
  );
  const map = new Map<string, CollectionStat>();
  for (const r of rows ?? []) {
    const albumId = lookupCode(r.code)?.catalog.id;
    if (!albumId) continue;
    const key = `${r.user_id}|${albumId}`;
    const s = map.get(key) ?? { user_id: r.user_id, album_id: albumId, itens: 0, repetidas: 0, itens_repetidos: 0 };
    s.itens += 1;
    s.repetidas += Math.max(r.qty - 1, 0);
    if (r.qty > 1) s.itens_repetidos += 1;
    map.set(key, s);
  }
  return [...map.values()];
}

async function allUsers(admin: Admin): Promise<User[]> {
  const out: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) return out;
  }
}

// dia no fuso de Brasília ("2026-10-10")
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function loadAdminStats(): Promise<AdminStats> {
  const admin = createAdminClient();
  const [users, stats, { data: userAlbums }, { data: shops }, { data: ents }, { data: subs }, { data: shopAlbums }, { data: orders }] =
    await Promise.all([
      allUsers(admin),
      collectionStats(admin),
      fetchAll<{ user_id: string; album_id: string; collection_name: string | null; created_at: string }>((from, to) =>
        admin.from("user_albums").select("user_id, album_id, collection_name, created_at").order("user_id").order("album_id").range(from, to)
      ),
      admin.from("shops").select("user_id, token, slug, seller_name, enabled"),
      admin.from("shop_entitlements").select("user_id, expires_at, source"),
      admin.from("subscriptions").select("user_id, status"),
      admin.from("shop_albums").select("user_id, album_id, enabled"),
      fetchAll<{ seller_id: string; status: "novo" | "confirmado" | "cancelado"; total_cents: number }>((from, to) =>
        admin.from("orders").select("seller_id, status, total_cents").order("created_at").order("id").range(from, to)
      ),
    ]);

  const now = Date.now();
  const DAY = 86_400_000;
  const stat = new Map(stats.map((s) => [`${s.user_id}|${s.album_id}`, s]));
  const access = new Map(
    ((ents ?? []) as { user_id: string; expires_at: string | null; source: "manual" | "stripe" }[])
      .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > now)
      .map((e) => [e.user_id, e.source])
  );
  const subStatus = new Map(((subs ?? []) as { user_id: string; status: string | null }[]).map((s) => [s.user_id, s.status]));
  const shopOf = new Map(
    ((shops ?? []) as { user_id: string; token: string; slug: string | null; seller_name: string | null; enabled: boolean }[]).map((s) => [s.user_id, s])
  );
  const forSale = new Map<string, string[]>();
  for (const a of (shopAlbums ?? []) as { user_id: string; album_id: string; enabled: boolean }[]) {
    if (a.enabled) forSale.set(a.user_id, [...(forSale.get(a.user_id) ?? []), a.album_id]);
  }
  const ordersOf = new Map<string, { novo: number; confirmado: number; cancelado: number; cents: number }>();
  for (const o of orders ?? []) {
    const t = ordersOf.get(o.seller_id) ?? { novo: 0, confirmado: 0, cancelado: 0, cents: 0 };
    t[o.status] += 1;
    if (o.status === "confirmado") t.cents += o.total_cents;
    ordersOf.set(o.seller_id, t);
  }
  const albumsOf = new Map<string, { album_id: string; created_at: string }[]>();
  for (const ua of userAlbums ?? []) albumsOf.set(ua.user_id, [...(albumsOf.get(ua.user_id) ?? []), ua]);

  const out: AdminUser[] = users.map((u) => {
    const collections: AdminCollection[] = CATALOGS.flatMap((c) => {
      const ua = albumsOf.get(u.id)?.find((a) => a.album_id === c.id);
      if (!ua) return [];
      const s = stat.get(`${u.id}|${c.id}`);
      return [{ albumId: c.id, name: c.shortName, total: c.total, items: s?.itens ?? 0, duplicates: s?.repetidas ?? 0, createdAt: ua.created_at }];
    });

    const row = shopOf.get(u.id);
    const acc = access.get(u.id) ?? null;
    let shop: AdminShop | null = null;
    if (row) {
      const albums = CATALOGS.filter((c) => forSale.get(u.id)?.includes(c.id)).map((c) => ({
        name: c.shortName,
        items: stat.get(`${u.id}|${c.id}`)?.itens_repetidos ?? 0,
      }));
      const o = ordersOf.get(u.id);
      shop = {
        name: row.seller_name || DEFAULT_SHOP_NAME,
        path: shopPath(row),
        enabled: row.enabled,
        open: row.enabled && acc !== null,
        access: acc,
        subscription: subStatus.get(u.id) ?? null,
        albums,
        items: albums.reduce((n, a) => n + a.items, 0),
        orders: { novo: o?.novo ?? 0, confirmado: o?.confirmado ?? 0, cancelado: o?.cancelado ?? 0 },
        confirmedCents: o?.cents ?? 0,
      };
    }

    return {
      id: u.id,
      name: str(u.user_metadata?.full_name),
      email: u.email ?? "",
      whatsapp: str(u.user_metadata?.whatsapp),
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      confirmed: !!u.email_confirmed_at,
      // assinante = acesso à loja em dia (assinatura no Stripe ou liberação manual)
      kind: acc ? "assinante" : collections.length ? "colecionador" : "sem-colecao",
      collections,
      items: collections.reduce((n, c) => n + c.items, 0),
      shop,
    };
  });
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const openShops = out.filter((u) => u.shop?.open);
  const since = (iso: string | null, days: number) => !!iso && now - new Date(iso).getTime() <= days * DAY;
  const sumOrders = (k: "novo" | "confirmado" | "cancelado") => out.reduce((n, u) => n + (u.shop?.orders[k] ?? 0), 0);

  // evolução diária desde a primeira conta
  const newUsers = new Map<string, number>();
  const newCols = new Map<string, number>();
  for (const u of out) newUsers.set(dayOf(u.createdAt), (newUsers.get(dayOf(u.createdAt)) ?? 0) + 1);
  for (const ua of userAlbums ?? []) newCols.set(dayOf(ua.created_at), (newCols.get(dayOf(ua.created_at)) ?? 0) + 1);
  const series: AdminStats["series"] = [];
  const first = [...newUsers.keys(), ...newCols.keys()].sort()[0];
  if (first) {
    const today = dayOf(new Date(now).toISOString());
    let users = 0;
    let collections = 0;
    for (let d = new Date(`${first}T12:00:00Z`); ; d = new Date(d.getTime() + DAY)) {
      const day = d.toISOString().slice(0, 10);
      users += newUsers.get(day) ?? 0;
      collections += newCols.get(day) ?? 0;
      series.push({ day, newUsers: newUsers.get(day) ?? 0, users, newCollections: newCols.get(day) ?? 0, collections });
      if (day >= today) break;
    }
  }

  return {
    generatedAt: new Date(now).toISOString(),
    users: out,
    totals: {
      accounts: out.length,
      confirmed: out.filter((u) => u.confirmed).length,
      assinantes: out.filter((u) => u.kind === "assinante").length,
      assinantesStripe: out.filter((u) => access.get(u.id) === "stripe").length,
      colecionadores: out.filter((u) => u.kind === "colecionador").length,
      semColecao: out.filter((u) => u.kind === "sem-colecao").length,
      new7: out.filter((u) => since(u.createdAt, 7)).length,
      new30: out.filter((u) => since(u.createdAt, 30)).length,
      active7: out.filter((u) => since(u.lastSignInAt, 7)).length,
      active30: out.filter((u) => since(u.lastSignInAt, 30)).length,
      collections: out.reduce((n, u) => n + u.collections.length, 0),
      items: out.reduce((n, u) => n + u.items, 0),
      shopsCreated: out.filter((u) => u.shop).length,
      shopsOpen: openShops.length,
      shopItems: openShops.reduce((n, u) => n + (u.shop?.items ?? 0), 0),
      orders: { novo: sumOrders("novo"), confirmado: sumOrders("confirmado"), cancelado: sumOrders("cancelado") },
      confirmedCents: out.reduce((n, u) => n + (u.shop?.confirmedCents ?? 0), 0),
    },
    albums: CATALOGS.map((c) => {
      const cols = out.flatMap((u) => u.collections.filter((x) => x.albumId === c.id));
      const lojas = openShops.flatMap((u) => u.shop!.albums.filter((a) => a.name === c.shortName));
      return {
        albumId: c.id,
        name: c.name,
        total: c.total,
        collections: cols.length,
        items: cols.reduce((n, x) => n + x.items, 0),
        duplicates: cols.reduce((n, x) => n + x.duplicates, 0),
        shops: lojas.length,
        shopItems: lojas.reduce((n, a) => n + a.items, 0),
      };
    }),
    series,
  };
}
