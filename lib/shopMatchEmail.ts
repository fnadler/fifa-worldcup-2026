import "server-only";
import type { User } from "@supabase/supabase-js";
import { getCatalog } from "./catalog";
import { emailConfigured, sendEmail } from "./email/resend";
import { shopMatchHtml, shopMatchSubject, shopMatchText, type ShopMatchEmailInput } from "./email/shopMatch";
import { matchShops } from "./shopMatch";
import { createAdminClient } from "./supabase/admin";
import { userCollections } from "./userCollections";

// "Lojas com o que falta na sua coleção" por e-mail. Por enquanto só o envio para UMA conta (teste do
// modelo); o envio para a base vem depois de aprovado o modelo.

const LOJAS_POR_COLECAO = 3;

function firstName(user: User): string | null {
  const nome = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return nome ? nome.split(/\s+/)[0] : null;
}

async function findUser(email: string): Promise<User | null> {
  const admin = createAdminClient();
  const alvo = email.trim().toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === alvo);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}

/** O conteúdo do e-mail de uma conta: as coleções dela em que alguma loja tem o que falta. */
export async function shopMatchInputFor(user: User): Promise<ShopMatchEmailInput> {
  const colecoes = await userCollections(createAdminClient(), user.id);
  const collections: ShopMatchEmailInput["collections"] = [];
  const todas = new Set<string>();
  for (const col of colecoes) {
    const r = await matchShops(user.id, col.albumId);
    if (!r.shops.length) continue;
    for (const s of r.shops) todas.add(s.path);
    collections.push({
      name: getCatalog(col.albumId).shortName,
      slug: r.slug,
      missing: r.missing,
      categories: r.categories.filter((c) => c.missing > 0).map(({ key, label }) => ({ key, label })),
      shops: r.shops.slice(0, LOJAS_POR_COLECAO),
      totalShops: r.shops.length,
      fullShops: r.shops.filter((s) => s.matched >= s.missing).length,
    });
  }
  return { firstName: firstName(user), collections, shopCount: todas.size };
}

export type ShopMatchPreview =
  | { status: "nao-encontrado" | "sem-lojas" }
  | { status: "ok"; subject: string; html: string; text: string; to: string };

export async function previewShopMatchEmail(email: string): Promise<ShopMatchPreview> {
  const user = await findUser(email);
  if (!user?.email) return { status: "nao-encontrado" };
  const input = await shopMatchInputFor(user);
  if (!input.collections.length) return { status: "sem-lojas" };
  return { status: "ok", to: user.email, subject: shopMatchSubject(input), html: shopMatchHtml(input), text: shopMatchText(input) };
}

/** Envia o e-mail a uma conta só (teste do modelo). */
export async function sendShopMatchEmailTo(email: string): Promise<{ status: string; id?: string }> {
  if (!emailConfigured()) return { status: "desligado" };
  const p = await previewShopMatchEmail(email);
  if (p.status !== "ok") return p;
  const id = await sendEmail({ to: p.to, subject: p.subject, html: p.html, text: p.text });
  return { status: "enviado", id };
}
