-- Migração: reserva os endereços das páginas públicas da plataforma (landing, termos, contato…)
-- para nenhuma loja usá-los como /nome-da-loja. Espelha RESERVED_SLUGS em lib/brand.ts.
-- Idempotente. Rode depois de supabase_migration_shop_identity.sql.

alter table public.shops drop constraint if exists shops_slug_format;
alter table public.shops
  add constraint shops_slug_format check (
    slug is null or (
      slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
      and char_length(slug) between 3 and 30
      and slug not in ('login', 'perfil', 'vendas', 'loja', 'lojas', 'publico', 'api', 'auth', 'assinar', 'assinatura', 'admin', 'app', 'conta', 'config', 'configuracoes', 'ajuda', 'suporte', 'termos', 'privacidade', 'icon', 'apple-icon', 'manifest', 'favicon', 'brand', 'stickers', 'static', 'gn', 'gnfigurinhas', 'gncoleciona', 'coleciona', 'colecao', 'contato', 'cancelamento', 'planos', 'cadastro', 'entrar', 'sobre', 'precos', 'faq', 'duvidas', 'blog', 'landing', 'home', 'inicio', 'site')
    )
  );
