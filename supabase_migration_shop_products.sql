-- Migração: produtos especiais da loja + carrinho único (itens de todas as coleções e produtos).
-- Rode no SQL Editor do Supabase depois das migrações anteriores. Idempotente.
--
-- Compatível com o site que está no ar: as funções antigas (hold_cart / place_order por coleção)
-- continuam existindo. O código novo usa hold_shop_cart / place_shop_order.
--
--   • shop_products (nova): produtos da loja (kits, dispensers…) com imagem, título, descrição,
--     preço e estoque. No carrinho e nos pedidos o produto usa o código "PRD:<id>".
--   • shop_stock(): estoque vendável de uma loja — repetidas (collection) + produtos ativos.
--     Reserva de carrinho, pedido e edição de pedido passam a conferir o estoque por ela.
--   • Carrinho: um por navegador e loja, com itens de qualquer coleção e produtos.
--   • Pedido: pode misturar coleções e produtos (orders.album_id deixa de ser obrigatório).
--   • Pedido mínimo: um valor para a loja inteira (shops.order_min_cents).

-- ---------- pedido mínimo da loja ----------
-- Começa com o maior mínimo das coleções à venda (antes o mínimo era por coleção).
alter table public.shops add column if not exists order_min_cents int;

update public.shops s
   set order_min_cents = coalesce(
         (select max(a.min_order_cents) from public.shop_albums a where a.user_id = s.user_id and a.enabled), 0)
 where s.order_min_cents is null;

alter table public.shops alter column order_min_cents set default 0;
alter table public.shops alter column order_min_cents set not null;
alter table public.shops drop constraint if exists shops_order_min_cents_check;
alter table public.shops add constraint shops_order_min_cents_check check (order_min_cents >= 0);

-- ---------- pedidos sem coleção fixa ----------
alter table public.orders alter column album_id drop not null;
alter table public.orders alter column album_id drop default;

-- ---------- produtos ----------
create table if not exists public.shop_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 600),
  price_cents int  not null check (price_cents between 0 and 10000000),
  stock       int  not null default 0 check (stock between 0 and 9999),
  image_url   text,
  active      boolean not null default true,
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists shop_products_user_idx on public.shop_products (user_id, position, created_at);

-- Imagem só do bucket de produtos, na pasta do próprio lojista (mesma regra do logo da loja).
alter table public.shop_products drop constraint if exists shop_products_image_own_bucket;
alter table public.shop_products
  add constraint shop_products_image_own_bucket check (
    image_url is null
    or starts_with(image_url, 'https://tonzoyloatfuhlrpynjv.supabase.co/storage/v1/object/public/shop-products/' || user_id::text || '/')
  );

alter table public.shop_products enable row level security;

-- O lojista vê e apaga os próprios produtos; criar/editar exige acesso à loja em dia.
-- A vitrine pública lê pelo servidor (service_role), como o resto da loja.
drop policy if exists "sellers read their own products"   on public.shop_products;
drop policy if exists "sellers insert their own products" on public.shop_products;
drop policy if exists "sellers update their own products" on public.shop_products;
drop policy if exists "sellers delete their own products" on public.shop_products;

create policy "sellers read their own products"
  on public.shop_products for select to authenticated
  using (auth.uid() = user_id);
create policy "sellers insert their own products"
  on public.shop_products for insert to authenticated
  with check (auth.uid() = user_id and public.has_shop_access(auth.uid()));
create policy "sellers update their own products"
  on public.shop_products for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sellers delete their own products"
  on public.shop_products for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.shop_products from anon;

-- Limite de produtos por loja.
create or replace function public.shop_products_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select count(*) from public.shop_products p where p.user_id = new.user_id) >= 60 then
    raise exception 'LIMITE_PRODUTOS';
  end if;
  return new;
end;
$$;

drop trigger if exists shop_products_limit on public.shop_products;
create trigger shop_products_limit
  before insert on public.shop_products
  for each row execute function public.shop_products_limit();

-- ---------- imagens dos produtos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-products', 'shop-products', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shop products: owner select" on storage.objects;
drop policy if exists "shop products: owner insert" on storage.objects;
drop policy if exists "shop products: owner update" on storage.objects;
drop policy if exists "shop products: owner delete" on storage.objects;

create policy "shop products: owner select" on storage.objects for select to authenticated
  using (bucket_id = 'shop-products' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "shop products: owner insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'shop-products'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_shop_access(auth.uid())
  );

create policy "shop products: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'shop-products' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'shop-products' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "shop products: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'shop-products' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- estoque vendável ----------
-- Um código por linha: figurinhas/cards (só as repetidas) e produtos ativos ("PRD:<id>").
-- security invoker: o servidor (service_role) lê qualquer loja; o lojista, só a própria.
create or replace function public.shop_stock(p_seller uuid)
returns table (code text, qty int)
language sql
stable
security invoker
set search_path = public
as $$
  select c.code, greatest(c.qty - 1, 0)
    from public.collection c
   where c.user_id = p_seller and c.qty > 1
  union all
  select 'PRD:' || p.id::text, p.stock
    from public.shop_products p
   where p.user_id = p_seller and p.active and p.stock > 0;
$$;

revoke execute on function public.shop_stock(uuid) from public, anon;
grant  execute on function public.shop_stock(uuid) to authenticated, service_role;

-- Códigos de p_items que não cabem no disponível (estoque - reservas de outros pedidos e carrinhos).
create or replace function public.unavailable_codes(
  p_seller uuid,
  p_items jsonb,
  p_exclude_order uuid default null,
  p_exclude_cart uuid default null
)
returns text[]
language sql
stable
security invoker
set search_path = public
as $$
  select array_agg(i.code order by i.code)
    from (
      select it->>'code' as code, sum((it->>'qty')::int)::int as q
        from jsonb_array_elements(p_items) it
       group by 1
    ) i
    left join public.shop_stock(p_seller) s on s.code = i.code
    left join public.reserved_qty(p_seller, p_exclude_order, p_exclude_cart) r on r.code = i.code
   where coalesce(s.qty, 0) - coalesce(r.qty, 0) < i.q;
$$;

-- ---------- carrinho único da loja ----------
-- Reserva (ou atualiza) o carrinho do navegador nesta loja, ajustando cada item ao disponível.
-- Prazo fixo a partir do primeiro item. Uma linha por carrinho e loja (carrinhos antigos, um por
-- coleção, são juntados aqui).
create or replace function public.hold_shop_cart(
  p_seller uuid,
  p_cart_id uuid,
  p_items jsonb,
  p_minutes int default 10
)
returns table (items jsonb, expires_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_items jsonb;
  v_prev  timestamptz;
  v_exp   timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_seller::text));
  perform public.expire_orders(p_seller);
  -- faxina: carrinhos vencidos há mais de 1 dia
  delete from public.cart_holds h where h.seller_id = p_seller and h.expires_at < now() - interval '1 day';

  with pedido as (
    select it->>'code' as code, sum((it->>'qty')::int)::int as q
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
     group by 1
  ), ajustado as (
    select p.code,
           least(p.q, greatest(coalesce(s.qty, 0) - coalesce(r.qty, 0), 0)) as q
      from pedido p
      left join public.shop_stock(p_seller) s on s.code = p.code
      -- reserved_qty ignora os carrinhos deste navegador com o vendedor
      left join public.reserved_qty(p_seller, null, p_cart_id) r on r.code = p.code
  )
  select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'qty', a.q) order by a.code), '[]'::jsonb)
    into v_items
    from ajustado a
   where a.q > 0;

  select max(h.expires_at) into v_prev
    from public.cart_holds h
   where h.cart_id = p_cart_id and h.seller_id = p_seller and h.expires_at > now();

  delete from public.cart_holds h where h.cart_id = p_cart_id and h.seller_id = p_seller;

  if jsonb_array_length(v_items) = 0 then
    return query select '[]'::jsonb, null::timestamptz;
    return;
  end if;

  -- prazo fixo a partir do primeiro item; vencido (ou inexistente), abre um novo
  v_exp := coalesce(v_prev, now() + make_interval(mins => p_minutes));

  -- album_id é só parte da chave antiga da tabela; o carrinho único usa sempre o mesmo valor
  insert into public.cart_holds (cart_id, seller_id, album_id, items, expires_at, updated_at)
  values (p_cart_id, p_seller, 'wc2026-panini', v_items, v_exp, now());

  return query select v_items, v_exp;
end;
$$;

revoke execute on function public.hold_shop_cart(uuid, uuid, jsonb, int) from public, anon, authenticated;
grant  execute on function public.hold_shop_cart(uuid, uuid, jsonb, int) to service_role;

-- Cria o pedido de forma atômica (só o servidor chama). O carrinho do comprador vira o pedido.
create or replace function public.place_shop_order(
  p_seller uuid,
  p_items jsonb,
  p_total_cents int,
  p_buyer jsonb,
  p_cart_id uuid default null
)
returns table (id uuid, number bigint, reserved_until timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_bad text[];
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_seller::text));
  perform public.expire_orders(p_seller);

  v_bad := public.unavailable_codes(p_seller, p_items, null, p_cart_id);
  if v_bad is not null then
    raise exception 'INDISPONIVEL:%', array_to_string(v_bad, ',');
  end if;

  if p_cart_id is not null then
    delete from public.cart_holds h where h.cart_id = p_cart_id and h.seller_id = p_seller;
  end if;

  return query
  insert into public.orders (
    seller_id, album_id, buyer_name, buyer_email, buyer_whatsapp,
    address_cep, address_street, address_number, address_complement,
    address_district, address_city, address_state, items, total_cents
  ) values (
    p_seller, null, p_buyer->>'name', p_buyer->>'email', p_buyer->>'whatsapp',
    p_buyer->>'cep', p_buyer->>'street', p_buyer->>'number', nullif(p_buyer->>'complement', ''),
    p_buyer->>'district', p_buyer->>'city', p_buyer->>'state', p_items, p_total_cents
  )
  returning orders.id, orders.number, orders.reserved_until;
end;
$$;

revoke execute on function public.place_shop_order(uuid, jsonb, int, jsonb, uuid) from public, anon, authenticated;
grant  execute on function public.place_shop_order(uuid, jsonb, int, jsonb, uuid) to service_role;

-- ---------- edição dos itens de um pedido novo (pelo dono) ----------
-- p_items = [{ code, qty, unit_cents, name? }]. `name` é o título do produto guardado no pedido.
create or replace function public.update_order_items(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  o      public.orders%rowtype;
  v_bad  text[];
  v_norm jsonb;
begin
  if auth.uid() is null then
    raise exception 'Pedido não encontrado';
  end if;
  perform pg_advisory_xact_lock(hashtext('orders:' || auth.uid()::text));
  perform public.expire_orders(auth.uid());

  select * into o from public.orders where id = p_order_id and seller_id = auth.uid() for update;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;
  if o.status <> 'novo' then
    raise exception 'Só pedidos novos podem ser editados (este está %)',
      case when o.cancel_reason = 'expirado' then 'expirado' else o.status end;
  end if;

  -- normaliza: soma códigos repetidos, descarta qty <= 0, valida código/limites
  select coalesce(
           jsonb_agg(jsonb_strip_nulls(jsonb_build_object('code', code, 'qty', q, 'unit_cents', u, 'name', n)) order by code),
           '[]'::jsonb)
    into v_norm
    from (
      select it->>'code' as code,
             sum((it->>'qty')::int)::int as q,
             max((it->>'unit_cents')::int) as u,
             max(it->>'name') as n
        from jsonb_array_elements(p_items) it
       group by 1
    ) x
   where q > 0;

  if jsonb_array_length(v_norm) = 0 then
    raise exception 'O pedido precisa ter pelo menos um item — para desistir, cancele o pedido';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_norm) it
     where (
             not exists (select 1 from public.stickers s where s.code = it->>'code')
             and not exists (
               select 1 from public.shop_products p
                where p.user_id = o.seller_id and 'PRD:' || p.id::text = it->>'code')
           )
        or (it->>'qty')::int > 99
        or (it->>'unit_cents')::int < 0
  ) then
    raise exception 'Item inválido no pedido';
  end if;

  v_bad := public.unavailable_codes(o.seller_id, v_norm, o.id);
  if v_bad is not null then
    raise exception 'Estoque insuficiente para %', array_to_string(v_bad, ', ');
  end if;

  update public.orders
     set items = v_norm,
         total_cents = (select sum((it->>'qty')::int * (it->>'unit_cents')::int) from jsonb_array_elements(v_norm) it),
         updated_at = now()
   where id = p_order_id;
end;
$$;

revoke execute on function public.update_order_items(uuid, jsonb) from public, anon;
grant  execute on function public.update_order_items(uuid, jsonb) to authenticated;

-- ---------- confirmar / cancelar pedido ----------
-- Confirmar dá baixa no estoque (repetidas e produtos); cancelar um confirmado devolve.
create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  o     public.orders%rowtype;
  it    jsonb;
  cur   int;
  v_qty int;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Pedido não encontrado';
  end if;
  perform pg_advisory_xact_lock(hashtext('orders:' || auth.uid()::text));
  perform public.expire_orders(auth.uid());

  select * into o from public.orders
   where id = p_order_id and seller_id = auth.uid()
   for update;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if o.status = p_status then
    return;
  end if;

  if o.status = 'cancelado' and o.cancel_reason = 'expirado' and p_status = 'confirmado' then
    raise exception 'A reserva deste pedido expirou — peça ao comprador para refazer o pedido';
  end if;

  if o.status = 'novo' and p_status = 'confirmado' then
    for it in select value from jsonb_array_elements(o.items) loop
      v_code := it->>'code';
      v_qty  := (it->>'qty')::int;
      if v_code like 'PRD:%' then
        cur := null;
        select p.stock into cur from public.shop_products p
         where p.user_id = o.seller_id and 'PRD:' || p.id::text = v_code
         for update;
        -- produto apagado depois do pedido: não há estoque para baixar
        if found then
          if cur < v_qty then
            raise exception 'Estoque insuficiente para %', coalesce(it->>'name', 'o produto');
          end if;
          update public.shop_products p
             set stock = p.stock - v_qty, updated_at = now()
           where p.user_id = o.seller_id and 'PRD:' || p.id::text = v_code;
        end if;
      else
        cur := null;
        select c.qty into cur from public.collection c
         where c.user_id = o.seller_id and c.code = v_code
         for update;
        if coalesce(cur, 0) - 1 < v_qty then
          raise exception 'Estoque insuficiente para %', v_code;
        end if;
        update public.collection c
           set qty = c.qty - v_qty, updated_at = now()
         where c.user_id = o.seller_id and c.code = v_code;
      end if;
    end loop;
  elsif o.status = 'confirmado' and p_status = 'cancelado' then
    for it in select value from jsonb_array_elements(o.items) loop
      v_code := it->>'code';
      v_qty  := (it->>'qty')::int;
      if v_code like 'PRD:%' then
        update public.shop_products p
           set stock = least(9999, p.stock + v_qty), updated_at = now()
         where p.user_id = o.seller_id and 'PRD:' || p.id::text = v_code;
      else
        insert into public.collection (user_id, code, qty, updated_at)
        values (o.seller_id, v_code, least(99, v_qty), now())
        on conflict (user_id, code) do update
          set qty = least(99, public.collection.qty + excluded.qty), updated_at = now();
      end if;
    end loop;
  elsif not (o.status = 'novo' and p_status = 'cancelado') then
    raise exception 'Transição de status inválida: % -> %', o.status, p_status;
  end if;

  update public.orders
     set status = p_status,
         cancel_reason = case when p_status = 'cancelado' then 'manual' else null end,
         updated_at = now()
   where id = p_order_id;
end;
$$;

revoke execute on function public.set_order_status(uuid, text) from public, anon;
grant  execute on function public.set_order_status(uuid, text) to authenticated;
