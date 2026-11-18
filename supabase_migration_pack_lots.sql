-- Migração: lotes de pacotes (Pacote Legends) — fase 1: lote, pote de Legends e pacotes numerados.
-- Rode no SQL Editor do Supabase depois das migrações anteriores. Idempotente.
--
--   • pack_access (nova): lojas liberadas para vender pacotes. Sem política de escrita — quem libera
--     é o admin, pelo Table Editor. A migração já libera a loja oficial.
--   • pack_lots (nova): o lote (título, descrição, imagem, preço, pedido mínimo, início, situação).
--   • pack_lot_legends (nova): o pote — uma linha por unidade de Legend separada para o lote. Ao entrar
--     no pote a Legend sai das repetidas do lojista (collection.qty), e volta se sair do pote.
--   • packs (nova): os pacotes numerados (1..N, N = Legends no pote), criados ao ativar o lote.
--     Pedido, figurinhas e Legend de cada pacote entram nas próximas fases.
--
-- Escrita só pelo servidor (service_role), sempre depois de conferir a sessão do lojista. As funções
-- de estoque recebem p_seller e usam a mesma trava dos pedidos (pg_advisory_xact_lock 'orders:<id>').

-- ---------- acesso ----------
create table if not exists public.pack_access (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pack_access enable row level security;
drop policy if exists "sellers read their own pack access" on public.pack_access;
create policy "sellers read their own pack access"
  on public.pack_access for select to authenticated
  using (auth.uid() = user_id);
revoke all on public.pack_access from anon;

insert into public.pack_access (user_id)
select s.user_id from public.shops s where s.slug = 'loja-oficial'
on conflict (user_id) do nothing;

-- ---------- lote ----------
create table if not exists public.pack_lots (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  title           text not null check (char_length(btrim(title)) between 2 and 80),
  description     text not null default '' check (char_length(description) <= 1500),
  image_url       text,
  price_cents     int  not null default 0 check (price_cents between 0 and 10000000),
  -- null = usa o pedido mínimo da loja
  min_order_cents int  check (min_order_cents is null or min_order_cents between 0 and 10000000),
  starts_at       timestamptz,
  status          text not null default 'rascunho' check (status in ('rascunho', 'ativo', 'pausado', 'encerrado')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (seller_id, slug)
);

create index if not exists pack_lots_seller_idx on public.pack_lots (seller_id, created_at desc);

-- Imagem só do bucket dos lotes, na pasta do próprio lojista.
alter table public.pack_lots drop constraint if exists pack_lots_image_own_bucket;
alter table public.pack_lots
  add constraint pack_lots_image_own_bucket check (
    image_url is null
    or starts_with(image_url, 'https://tonzoyloatfuhlrpynjv.supabase.co/storage/v1/object/public/pack-lots/' || seller_id::text || '/')
  );

-- ---------- pote ----------
create table if not exists public.pack_lot_legends (
  id         uuid primary key default gen_random_uuid(),
  lot_id     uuid not null references public.pack_lots(id) on delete cascade,
  code       text not null references public.stickers(code),
  -- preenchidos na abertura do pacote (fase 4)
  pack_id    uuid,
  drawn_at   timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pack_lot_legends_lot_idx on public.pack_lot_legends (lot_id, pack_id);

-- ---------- pacotes ----------
create table if not exists public.packs (
  id          uuid primary key default gen_random_uuid(),
  lot_id      uuid not null references public.pack_lots(id) on delete cascade,
  number      int  not null check (number between 1 and 999),
  -- fases seguintes: pedido, as 7 figurinhas sorteadas no pedido, a Legend sorteada na abertura
  order_id    uuid references public.orders(id) on delete set null,
  commons     jsonb,
  legend_code text references public.stickers(code),
  opened_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (lot_id, number)
);

create index if not exists packs_order_idx on public.packs (order_id) where order_id is not null;

alter table public.pack_lot_legends drop constraint if exists pack_lot_legends_pack_fk;
alter table public.pack_lot_legends
  add constraint pack_lot_legends_pack_fk foreign key (pack_id) references public.packs(id) on delete set null;

-- ---------- leitura (o lojista vê os próprios lotes; a vitrine lê pelo servidor) ----------
alter table public.pack_lots        enable row level security;
alter table public.pack_lot_legends enable row level security;
alter table public.packs            enable row level security;

drop policy if exists "sellers read their own pack lots" on public.pack_lots;
create policy "sellers read their own pack lots"
  on public.pack_lots for select to authenticated
  using (auth.uid() = seller_id);

drop policy if exists "sellers read their own pack legends" on public.pack_lot_legends;
create policy "sellers read their own pack legends"
  on public.pack_lot_legends for select to authenticated
  using (exists (select 1 from public.pack_lots l where l.id = lot_id and l.seller_id = auth.uid()));

drop policy if exists "sellers read their own packs" on public.packs;
create policy "sellers read their own packs"
  on public.packs for select to authenticated
  using (exists (select 1 from public.pack_lots l where l.id = lot_id and l.seller_id = auth.uid()));

revoke all on public.pack_lots, public.pack_lot_legends, public.packs from anon;
revoke insert, update, delete on public.pack_lots, public.pack_lot_legends, public.packs from authenticated;

-- ---------- imagens dos lotes ----------
-- Envio pelo servidor (service_role); o bucket é público para a página do lote.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pack-lots', 'pack-lots', true, 3145728, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- pote: colocar Legends ----------
-- p_codes: uma entrada por unidade (['LIL13','LIL13','BRO2'] = 2 Messi Lilás e 1 Hakimi Bronze).
-- Só em rascunho; só Legends; só o que está livre nas repetidas (qty - 1 - reservas de pedidos e
-- carrinhos). As unidades saem da collection do lojista.
create or replace function public.pack_lot_add_legends(p_seller uuid, p_lot uuid, p_codes text[])
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_bad    text[];
  v_total  int;
  r        record;
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_seller::text));
  perform public.expire_orders(p_seller);

  select l.status into v_status from public.pack_lots l where l.id = p_lot and l.seller_id = p_seller for update;
  if not found then
    raise exception 'Lote não encontrado';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'O pote só muda com o lote em rascunho';
  end if;
  if coalesce(array_length(p_codes, 1), 0) = 0 then
    return 0;
  end if;

  if exists (
    select 1 from unnest(p_codes) c
     where not exists (select 1 from public.stickers s where s.code = c and s.block_type = 'LEG')
  ) then
    raise exception 'Só Legends podem entrar no pote';
  end if;

  select count(*) + coalesce(array_length(p_codes, 1), 0) into v_total
    from public.pack_lot_legends where lot_id = p_lot;
  if v_total > 500 then
    raise exception 'Um lote pode ter no máximo 500 pacotes';
  end if;

  select array_agg(i.code order by i.code) into v_bad
    from (select c as code, count(*)::int as n from unnest(p_codes) c group by c) i
    left join public.collection col on col.user_id = p_seller and col.code = i.code
    left join public.reserved_qty(p_seller, null, null) res on res.code = i.code
   where greatest(coalesce(col.qty, 0) - 1, 0) - coalesce(res.qty, 0) < i.n;
  if v_bad is not null then
    raise exception 'INDISPONIVEL:%', array_to_string(v_bad, ',');
  end if;

  for r in select c as code, count(*)::int as n from unnest(p_codes) c group by c loop
    update public.collection
       set qty = qty - r.n, updated_at = now()
     where user_id = p_seller and code = r.code;
    insert into public.pack_lot_legends (lot_id, code)
    select p_lot, r.code from generate_series(1, r.n);
  end loop;

  update public.pack_lots set updated_at = now() where id = p_lot;
  return coalesce(array_length(p_codes, 1), 0);
end;
$$;

-- Devolve uma unidade (ou várias) às repetidas do lojista.
create or replace function public.pack_return_legend(p_seller uuid, p_code text, p_qty int)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.collection (user_id, code, qty, updated_at)
  values (p_seller, p_code, least(99, p_qty), now())
  on conflict (user_id, code) do update
    set qty = least(99, public.collection.qty + excluded.qty), updated_at = now();
$$;

-- ---------- pote: tirar Legends ----------
create or replace function public.pack_lot_remove_legends(p_seller uuid, p_lot uuid, p_code text, p_qty int)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  v_n      int;
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_seller::text));

  select l.status into v_status from public.pack_lots l where l.id = p_lot and l.seller_id = p_seller for update;
  if not found then
    raise exception 'Lote não encontrado';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'O pote só muda com o lote em rascunho';
  end if;

  with gone as (
    delete from public.pack_lot_legends
     where id in (
       select id from public.pack_lot_legends
        where lot_id = p_lot and code = p_code and pack_id is null
        order by created_at desc
        limit greatest(p_qty, 0)
     )
    returning 1
  )
  select count(*)::int into v_n from gone;

  if v_n > 0 then
    perform public.pack_return_legend(p_seller, p_code, v_n);
    update public.pack_lots set updated_at = now() where id = p_lot;
  end if;
  return v_n;
end;
$$;

-- ---------- excluir lote (só rascunho): o pote volta para as repetidas ----------
create or replace function public.pack_lot_delete(p_seller uuid, p_lot uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
  r        record;
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_seller::text));

  select l.status into v_status from public.pack_lots l where l.id = p_lot and l.seller_id = p_seller for update;
  if not found then
    raise exception 'Lote não encontrado';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'Só um lote em rascunho pode ser excluído';
  end if;

  for r in select code, count(*)::int as n from public.pack_lot_legends where lot_id = p_lot group by code loop
    perform public.pack_return_legend(p_seller, r.code, r.n);
  end loop;
  delete from public.pack_lots where id = p_lot;
end;
$$;

-- ---------- situação do lote ----------
--   rascunho → ativo: precisa de preço e de pelo menos 1 Legend; cria os pacotes 1..N.
--   ativo ⇄ pausado: pausado sai da vitrine e não recebe pedidos.
--   ativo/pausado → rascunho: só se nenhum pacote tem pedido; apaga os pacotes (o pote fica).
--   encerrado: automático, quando todos os pacotes forem abertos (fase 4).
create or replace function public.pack_lot_set_status(p_seller uuid, p_lot uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  l   public.pack_lots%rowtype;
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_seller::text));

  select * into l from public.pack_lots where id = p_lot and seller_id = p_seller for update;
  if not found then
    raise exception 'Lote não encontrado';
  end if;
  if l.status = p_status then
    return;
  end if;

  if l.status = 'rascunho' and p_status = 'ativo' then
    if l.price_cents <= 0 then
      raise exception 'Defina o preço do pacote antes de ativar o lote';
    end if;
    select count(*)::int into v_n from public.pack_lot_legends where lot_id = p_lot;
    if v_n = 0 then
      raise exception 'Coloque Legends no pote antes de ativar o lote';
    end if;
    delete from public.packs where lot_id = p_lot;
    insert into public.packs (lot_id, number) select p_lot, g from generate_series(1, v_n) g;
  elsif l.status in ('ativo', 'pausado') and p_status in ('ativo', 'pausado') then
    null;
  elsif l.status in ('ativo', 'pausado') and p_status = 'rascunho' then
    if exists (select 1 from public.packs where lot_id = p_lot and order_id is not null) then
      raise exception 'Este lote já tem pedidos e não pode voltar para rascunho';
    end if;
    delete from public.packs where lot_id = p_lot;
  else
    raise exception 'Mudança de situação inválida: % -> %', l.status, p_status;
  end if;

  update public.pack_lots set status = p_status, updated_at = now() where id = p_lot;
end;
$$;

revoke execute on function public.pack_lot_add_legends(uuid, uuid, text[])        from public, anon, authenticated;
revoke execute on function public.pack_return_legend(uuid, text, int)             from public, anon, authenticated;
revoke execute on function public.pack_lot_remove_legends(uuid, uuid, text, int)  from public, anon, authenticated;
revoke execute on function public.pack_lot_delete(uuid, uuid)                     from public, anon, authenticated;
revoke execute on function public.pack_lot_set_status(uuid, uuid, text)           from public, anon, authenticated;
grant  execute on function public.pack_lot_add_legends(uuid, uuid, text[])        to service_role;
grant  execute on function public.pack_return_legend(uuid, text, int)             to service_role;
grant  execute on function public.pack_lot_remove_legends(uuid, uuid, text, int)  to service_role;
grant  execute on function public.pack_lot_delete(uuid, uuid)                     to service_role;
grant  execute on function public.pack_lot_set_status(uuid, uuid, text)           to service_role;
