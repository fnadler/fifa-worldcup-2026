-- Migração: catálogo de coleções (álbuns), opção "só disponíveis" da loja e aceite do comprador
-- Rode depois das migrações anteriores. Idempotente.
--
--   • albums: coleções que a plataforma oferece. Por enquanto só "World Cup FIFA 2026 - Panini".
--     Com mais de uma ativa, a criação de conta mostra a lista para o usuário escolher.
--     stickers.album_id marca a qual coleção cada figurinha pertence (hoje, todas nesta).
--     Obs.: para uma 2ª coleção de fato, os códigos (hoje únicos: BRA1…) e a tabela collection
--     precisarão incluir album_id — esta migração só prepara o terreno.
--   • shops.only_available: a loja mostra só as figurinhas à venda (sem o filtro "Catálogo completo").
--   • orders.buyer_ack_at: quando o comprador confirmou ter lido as orientações de segurança.

create table if not exists public.albums (
  id         text primary key,
  name       text not null,
  active     boolean not null default true,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.albums (id, name, position)
values ('wc2026-panini', 'World Cup FIFA 2026 - Panini', 1)
on conflict (id) do update set name = excluded.name;

alter table public.albums enable row level security;

-- A lista de coleções ativas é pública (aparece na tela de criar conta, antes do login).
drop policy if exists "active albums are public" on public.albums;
create policy "active albums are public"
  on public.albums for select to anon, authenticated
  using (active);

alter table public.stickers
  add column if not exists album_id text not null default 'wc2026-panini' references public.albums(id);

alter table public.shops add column if not exists only_available boolean not null default false;

alter table public.orders add column if not exists buyer_ack_at timestamptz;
