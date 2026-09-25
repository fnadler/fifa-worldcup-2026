-- Migração: identidade da loja — endereço amigável (/nome-da-loja) e imagem própria
-- Rode depois das migrações anteriores. Idempotente.
--
--   • shops.slug: endereço público da loja, gerado do nome (ex: "Figurinhas do Zé" → figurinhas-do-ze).
--     Único; não pode usar caminhos do próprio app (lista espelhada em lib/brand.ts).
--   • shops.logo_url: imagem da loja (Supabase Storage, bucket público "shop-logos").
--     Sem imagem, a loja usa o logo padrão da plataforma.

alter table public.shops add column if not exists slug text;
alter table public.shops add column if not exists logo_url text;

create unique index if not exists shops_slug_key on public.shops (slug);

alter table public.shops drop constraint if exists shops_slug_format;
alter table public.shops
  add constraint shops_slug_format check (
    slug is null or (
      slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
      and char_length(slug) between 3 and 30
      and slug not in ('login', 'perfil', 'vendas', 'loja', 'lojas', 'publico', 'api', 'auth', 'assinar', 'assinatura', 'admin', 'app', 'conta', 'config', 'configuracoes', 'ajuda', 'suporte', 'termos', 'privacidade', 'icon', 'apple-icon', 'manifest', 'favicon', 'brand', 'stickers', 'static', 'gn', 'gnfigurinhas', 'gncoleciona', 'coleciona')
    )
  );

-- Disponibilidade de um endereço (o RLS não deixa o lojista ver as lojas dos outros).
-- Só responde sim/não — não revela de quem é.
create or replace function public.shop_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.shops where slug = p_slug and user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

revoke execute on function public.shop_slug_available(text) from public, anon;
grant  execute on function public.shop_slug_available(text) to authenticated;

-- ---------- imagens das lojas ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-logos', 'shop-logos', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada lojista (com acesso à loja) só mexe na própria pasta: shop-logos/<user_id>/...
-- A leitura é pública pela URL do bucket; a policy de select é para o próprio dono (upsert/remoção).
drop policy if exists "shop logos: owner select" on storage.objects;
drop policy if exists "shop logos: owner insert" on storage.objects;
drop policy if exists "shop logos: owner update" on storage.objects;
drop policy if exists "shop logos: owner delete" on storage.objects;

create policy "shop logos: owner select" on storage.objects for select to authenticated
  using (bucket_id = 'shop-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "shop logos: owner insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_shop_access(auth.uid())
  );

create policy "shop logos: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'shop-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'shop-logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "shop logos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'shop-logos' and (storage.foldername(name))[1] = auth.uid()::text);
