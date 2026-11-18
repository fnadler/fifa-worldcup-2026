-- Migração: lotes de pacotes — fase 2: pedido de pacotes com as 7 figurinhas sorteadas e reservadas.
-- Rode no SQL Editor do Supabase depois de supabase_migration_pack_lots.sql. Idempotente.
--
--   • orders ganha:
--       hidden_items  — figurinhas sorteadas para os pacotes do pedido ([{code, qty}]). Reservam estoque
--                       como os itens, mas o comprador não vê (nem na mensagem do pedido).
--       pack_token    — link secreto dos pacotes do pedido (/pacote/<token>, fase 4).
--       buyer_user_id — conta do comprador (sessão ou e-mail igual ao de uma conta), para evitar
--                       figurinhas que ele já tem.
--   • No pedido, o pacote é um item "PACK:<id do lote>" (qty = nº de pacotes, nome com os números).
--   • place_pack_order: reserva os números, sorteia as 7 figurinhas de cada pacote (diferentes entre si,
--     dando preferência às que o comprador não tem) e grava o pedido.
--   • reserved_qty passa a contar hidden_items; set_order_status dá baixa/devolve hidden_items e não
--     cancela pedido com pacote aberto; update_order_items recusa pedidos com pacotes.

-- ---------- colunas ----------
alter table public.orders add column if not exists hidden_items  jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists pack_token    text;
alter table public.orders add column if not exists buyer_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists orders_pack_token_key on public.orders (pack_token) where pack_token is not null;

-- ---------- reserva: itens + figurinhas dos pacotes ----------
create or replace function public.reserved_qty(
  p_seller uuid,
  p_exclude_order uuid default null,
  p_exclude_cart uuid default null
)
returns table (code text, qty int)
language sql
stable
security definer
set search_path = public
as $$
  select x.code, sum(x.q)::int
    from (
      select it->>'code' as code, (it->>'qty')::int as q
        from public.orders o, jsonb_array_elements(o.items || o.hidden_items) it
       where o.seller_id = p_seller
         and o.status = 'novo'
         and o.reserved_until > now()
         and (p_exclude_order is null or o.id <> p_exclude_order)
      union all
      select it->>'code', (it->>'qty')::int
        from public.cart_holds h, jsonb_array_elements(h.items) it
       where h.seller_id = p_seller
         and h.expires_at > now()
         and (p_exclude_cart is null or h.cart_id <> p_exclude_cart)
    ) x
   group by x.code;
$$;

revoke execute on function public.reserved_qty(uuid, uuid, uuid) from public, anon;
grant  execute on function public.reserved_qty(uuid, uuid, uuid) to authenticated, service_role;

-- ---------- pedido de pacotes ----------
-- p_numbers: números escolhidos. p_buyer: dados do comprador (mesmo formato de place_shop_order).
-- p_buyer_user: conta da sessão (null = procura uma conta com o e-mail do pedido).
create or replace function public.place_pack_order(
  p_seller uuid,
  p_lot uuid,
  p_numbers int[],
  p_buyer jsonb,
  p_buyer_user uuid default null
)
returns table (id uuid, number bigint, reserved_until timestamptz, pack_token text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  l        public.pack_lots%rowtype;
  v_n      int;
  v_taken  int[];
  v_buyer  uuid;
  v_order  uuid;
  v_token  text;
  v_pack   record;
  v_pick   text[];
  v_hidden jsonb;
  v_label  text;
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || p_seller::text));
  perform public.expire_orders(p_seller);

  select * into l from public.pack_lots where id = p_lot and seller_id = p_seller;
  if not found or l.status <> 'ativo' or (l.starts_at is not null and l.starts_at > now()) then
    raise exception 'LOTE_FECHADO';
  end if;

  v_n := coalesce(array_length(p_numbers, 1), 0);
  if v_n = 0 or v_n > 500 or (select count(distinct x) from unnest(p_numbers) x) <> v_n then
    raise exception 'Números inválidos';
  end if;

  -- livres: sem pedido, ou com pedido cancelado
  select array_agg(x order by x) into v_taken
    from unnest(p_numbers) x
   where not exists (
           select 1 from public.packs p
            where p.lot_id = p_lot and p.number = x
              and (p.order_id is null
                   or exists (select 1 from public.orders o where o.id = p.order_id and o.status = 'cancelado'))
         );
  if v_taken is not null then
    raise exception 'OCUPADOS:%', array_to_string(v_taken, ',');
  end if;

  v_buyer := coalesce(
    p_buyer_user,
    (select u.id from auth.users u where lower(u.email) = lower(p_buyer->>'email') limit 1)
  );

  -- disponível por figurinha da Copa 2026 (sem Legends): repetidas - reservas
  create temp table if not exists pack_pool (code text primary key, avail int, owned boolean) on commit drop;
  truncate pack_pool;
  insert into pack_pool (code, avail, owned)
  select c.code,
         greatest(c.qty - 1, 0) - coalesce(r.qty, 0),
         exists (select 1 from public.collection b where v_buyer is not null and b.user_id = v_buyer and b.code = c.code and b.qty > 0)
    from public.collection c
    join public.stickers s on s.code = c.code and s.album_id = 'wc2026-panini' and s.block_type <> 'LEG'
    left join public.reserved_qty(p_seller, null, null) r on r.code = c.code
   where c.user_id = p_seller and c.qty > 1;
  delete from pack_pool where avail <= 0;

  insert into public.orders (
    seller_id, album_id, buyer_name, buyer_email, buyer_whatsapp,
    address_cep, address_street, address_number, address_complement,
    address_district, address_city, address_state, items, total_cents,
    pack_token, buyer_user_id
  ) values (
    p_seller, null, p_buyer->>'name', p_buyer->>'email', p_buyer->>'whatsapp',
    p_buyer->>'cep', p_buyer->>'street', p_buyer->>'number', nullif(p_buyer->>'complement', ''),
    p_buyer->>'district', p_buyer->>'city', p_buyer->>'state', '[]'::jsonb, v_n * l.price_cents,
    replace(gen_random_uuid()::text, '-', ''), v_buyer
  )
  returning orders.id, orders.pack_token into v_order, v_token;

  -- 7 figurinhas diferentes por pacote: primeiro as que o comprador não tem; entre elas, sorteio
  -- proporcional ao estoque livre (cada unidade com a mesma chance).
  for v_pack in select x as num from unnest(p_numbers) x order by x loop
    select array_agg(code) into v_pick
      from (
        select code from pack_pool
         where avail > 0
         order by owned, -ln(1 - random()) / avail
         limit 7
      ) t;
    if coalesce(array_length(v_pick, 1), 0) < 7 then
      raise exception 'SEM_FIGURINHAS';
    end if;
    update pack_pool set avail = avail - 1 where code = any(v_pick);
    update public.packs
       set order_id = v_order, commons = to_jsonb(v_pick), legend_code = null, opened_at = null
     where lot_id = p_lot and number = v_pack.num;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'qty', q) order by code), '[]'::jsonb) into v_hidden
    from (
      select c as code, count(*)::int as q
        from public.packs p, jsonb_array_elements_text(p.commons) c
       where p.order_id = v_order
       group by c
    ) t;

  v_label := l.title || ' · nº ' || (select string_agg(lpad(x::text, 2, '0'), ', ' order by x) from unnest(p_numbers) x);

  return query
  update public.orders o
     set items = jsonb_build_array(jsonb_build_object(
           'code', 'PACK:' || l.id::text, 'qty', v_n, 'unit_cents', l.price_cents, 'name', v_label)),
         hidden_items = v_hidden
   where o.id = v_order
  returning o.id, o.number, o.reserved_until, o.pack_token;
end;
$$;

revoke execute on function public.place_pack_order(uuid, uuid, int[], jsonb, uuid) from public, anon, authenticated;
grant  execute on function public.place_pack_order(uuid, uuid, int[], jsonb, uuid) to service_role;

-- ---------- edição de pedido: pedidos com pacotes não são editados ----------
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
  if exists (select 1 from jsonb_array_elements(o.items) it where it->>'code' like 'PACK:%')
     or jsonb_array_length(o.hidden_items) > 0 then
    raise exception 'Pedidos de pacotes não podem ser editados';
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
-- Confirmar dá baixa no estoque (repetidas, produtos e figurinhas dos pacotes); cancelar um confirmado
-- devolve. Pedido com pacote já aberto não pode ser cancelado.
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

  if p_status = 'cancelado'
     and exists (select 1 from public.packs p where p.order_id = o.id and p.opened_at is not null) then
    raise exception 'Este pedido tem pacote aberto e não pode ser cancelado';
  end if;

  if o.status = 'novo' and p_status = 'confirmado' then
    for it in select value from jsonb_array_elements(o.items || o.hidden_items) loop
      v_code := it->>'code';
      v_qty  := (it->>'qty')::int;
      if v_code like 'PACK:%' then
        continue;
      elsif v_code like 'PRD:%' then
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
    for it in select value from jsonb_array_elements(o.items || o.hidden_items) loop
      v_code := it->>'code';
      v_qty  := (it->>'qty')::int;
      if v_code like 'PACK:%' then
        continue;
      elsif v_code like 'PRD:%' then
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
