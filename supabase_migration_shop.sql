-- Migração: loja (venda de repetidas) + pedidos
-- Rode isto no SQL Editor do Supabase depois de supabase_schema.sql e
-- supabase_migration_public_share.sql.
--
-- Valores em centavos (int). Preço nulo = sem preço = figurinha não vendável.
-- Disponível para venda = qty - 1 (só as repetidas; a colada nunca é vendida).

create table if not exists public.shops (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  token            text not null unique,
  enabled          boolean not null default true,
  seller_name      text,
  whatsapp         text,                                  -- só dígitos, com DDI (ex: 5511999998888)
  min_order_cents  int  not null default 0 check (min_order_cents >= 0),
  price_fwc_cents  int  check (price_fwc_cents  >= 0),
  price_team_cents int  check (price_team_cents >= 0),
  price_cc_cents   int  check (price_cc_cents   >= 0),
  updated_at       timestamptz not null default now()
);

create table if not exists public.sticker_prices (
  user_id     uuid not null references auth.users(id) on delete cascade,
  code        text not null references public.stickers(code) on delete cascade,
  price_cents int  not null check (price_cents >= 0),
  primary key (user_id, code)
);

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           bigint generated always as identity,
  seller_id        uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'novo' check (status in ('novo','confirmado','cancelado')),
  buyer_name       text not null,
  buyer_email      text not null,
  buyer_whatsapp   text not null,
  address_cep      text not null,
  address_street   text not null,
  address_number   text not null,
  address_complement text,
  address_district text not null,
  address_city     text not null,
  address_state    text not null,
  items            jsonb not null,                        -- [{ code, qty, unit_cents }]
  total_cents      int  not null check (total_cents >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists orders_seller_idx on public.orders(seller_id, created_at desc);

alter table public.shops          enable row level security;
alter table public.sticker_prices enable row level security;
alter table public.orders         enable row level security;

-- O dono gerencia só a própria loja/preços. Como em collection_shares, não há
-- policy para anon: a página pública e a criação de pedidos rodam no servidor
-- com a service_role key.
create policy "users manage their own shop"
  on public.shops for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own prices"
  on public.sticker_prices for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sellers read their own orders"
  on public.orders for select to authenticated using (auth.uid() = seller_id);
create policy "sellers update their own orders"
  on public.orders for update to authenticated
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

-- Muda o status do pedido e mexe no estoque na mesma transação:
--   novo       -> confirmado : dá baixa (exige qty - 1 >= itens, senão erro)
--   confirmado -> cancelado  : devolve ao estoque
--   novo       -> cancelado  : só muda o status
-- security invoker: roda com o RLS de quem chama, então só o dono consegue.
create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  o   public.orders%rowtype;
  it  jsonb;
  cur int;
begin
  select * into o from public.orders
   where id = p_order_id and seller_id = auth.uid()
   for update;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if o.status = p_status then
    return;
  end if;

  if o.status = 'novo' and p_status = 'confirmado' then
    for it in select value from jsonb_array_elements(o.items) loop
      select qty into cur from public.collection
       where user_id = o.seller_id and code = it->>'code'
       for update;
      if coalesce(cur, 0) - 1 < (it->>'qty')::int then
        raise exception 'Estoque insuficiente para %', it->>'code';
      end if;
      update public.collection
         set qty = qty - (it->>'qty')::int, updated_at = now()
       where user_id = o.seller_id and code = it->>'code';
    end loop;
  elsif o.status = 'confirmado' and p_status = 'cancelado' then
    for it in select value from jsonb_array_elements(o.items) loop
      insert into public.collection (user_id, code, qty, updated_at)
      values (o.seller_id, it->>'code', least(99, (it->>'qty')::int), now())
      on conflict (user_id, code) do update
        set qty = least(99, public.collection.qty + excluded.qty), updated_at = now();
    end loop;
  elsif not (o.status = 'novo' and p_status = 'cancelado') then
    raise exception 'Transição de status inválida: % -> %', o.status, p_status;
  end if;

  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
end;
$$;

revoke execute on function public.set_order_status(uuid, text) from public, anon;
grant  execute on function public.set_order_status(uuid, text) to authenticated;
