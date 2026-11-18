-- Migração: lotes de pacotes — fase 3: aviso ao comprador quando o pedido é confirmado.
-- Rode no SQL Editor do Supabase depois de supabase_migration_pack_orders.sql. Idempotente.
--
--   • orders.packs_notified_at: quando o e-mail "seus pacotes estão prontos" foi enviado (evita repetir).
--   • "pacote" e "pacotes" passam a ser endereços reservados (a página do comprador é /pacote/<token>).
--     NOT VALID: não confere lojas que já existem, só novos endereços.

alter table public.orders add column if not exists packs_notified_at timestamptz;

alter table public.shops drop constraint if exists shops_slug_format;
alter table public.shops
  add constraint shops_slug_format check (
    slug is null or (
      slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
      and char_length(slug) between 3 and 30
      and slug not in ('login', 'perfil', 'vendas', 'loja', 'lojas', 'publico', 'api', 'auth', 'assinar', 'assinatura', 'admin', 'app', 'conta', 'config', 'configuracoes', 'ajuda', 'suporte', 'termos', 'privacidade', 'icon', 'apple-icon', 'manifest', 'favicon', 'brand', 'stickers', 'static', 'gn', 'gnfigurinhas', 'gncoleciona', 'coleciona', 'colecao', 'contato', 'cancelamento', 'planos', 'cadastro', 'entrar', 'sobre', 'precos', 'faq', 'duvidas', 'blog', 'landing', 'home', 'inicio', 'site', 'pacote', 'pacotes')
    )
  ) not valid;
