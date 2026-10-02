-- Migração: várias coleções (Fase 2 — coleções na conta). Rode depois de supabase_migration_collections.sql.
-- Idempotente.
--
--   • Adrenalyn XL passa a ativa: aparece no cadastro e em /colecoes.
--   • collection_shares: um link público por coleção (antes, um por usuário).
--   • "colecoes" vira endereço reservado (página de adicionar coleções) — espelha lib/brand.ts.

update public.albums set active = true where id = 'wc2026-adrenalyn';

alter table public.collection_shares drop constraint if exists collection_shares_user_id_key;
create unique index if not exists collection_shares_user_album_key
  on public.collection_shares(user_id, album_id);

alter table public.shops drop constraint if exists shops_slug_format;
alter table public.shops
  add constraint shops_slug_format check (
    slug is null or (
      slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
      and char_length(slug) between 3 and 30
      and slug not in ('login', 'perfil', 'vendas', 'loja', 'lojas', 'publico', 'api', 'auth', 'assinar', 'assinatura', 'admin', 'app', 'conta', 'config', 'configuracoes', 'ajuda', 'suporte', 'termos', 'privacidade', 'icon', 'apple-icon', 'manifest', 'favicon', 'brand', 'stickers', 'static', 'gn', 'gnfigurinhas', 'gncoleciona', 'coleciona', 'colecao', 'colecoes', 'contato', 'cancelamento', 'planos', 'cadastro', 'entrar', 'sobre', 'precos', 'faq', 'duvidas', 'blog', 'landing', 'home', 'inicio', 'site')
    )
  );
