-- Migração: reserva de estoque por pedido (5h) + edição de pedidos
-- Rode depois das migrações anteriores. Idempotente.
--
-- Regras:
--   • Pedido "novo" reserva seus itens até reserved_until (criação + 5h).
--   • Disponível na loja = (qty - 1) - reservado por pedidos novos dentro do prazo.
--   • Passou do prazo sem confirmar → cancelado (cancel_reason = 'expirado'). Toda conta de
--     reserva olha o prazo, então a liberação é imediata; a troca de status acontece na próxima
--     vez que loja/admin/novo pedido tocam no banco (expire_orders) — não precisa de cron.
--   • Estoque só sai da coleção ao confirmar (set_order_status).
--   • Criação, edição e confirmação travam por vendedor (advisory lock) para não vender a mesma
--     repetida duas vezes em pedidos simultâneos.

alter table public.orders add column if not exists reserved_until timestamptz;
update public.orders set reserved_until = created_at + interval '5 hours' where reserved_until is null;
alter table public.orders alter column reserved_until set default (now() + interval '5 hours');
alter table public.orders alter column reserved_until set not null;

alter table public.orders add column if not exists cancel_reason text;
alter table public.orders drop constraint if exists orders_cancel_reason_check;
alter table public.orders
  add constraint orders_cancel_reason_check check (cancel_reason in ('manual', 'expirado'));

create index if not exists orders_active_idx on public.orders(seller_id) where status = 'novo';

-- Cancela os pedidos novos do vendedor cujo prazo de reserva acabou.
-- security definer: só mexe em pedidos já vencidos, então é seguro qualquer um chamar.
create or replace function public.expire_orders(p_seller uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
     set status = 'cancelado', cancel_reason = 'expirado', updated_at = now()
   where seller_id = p_seller and status = 'novo' and reserved_until <= now();
$$;

-- Quantidade reservada por código (pedidos novos dentro do prazo), opcionalmente
-- ignorando um pedido (usado ao editar esse próprio pedido).
create or replace function public.reserved_qty(p_seller uuid, p_exclude uuid default null)
returns table (code text, qty int)
language sql
stable
security invoker
set search_path = public
as $$
  select it->>'code', sum((it->>'qty')::int)::int
    from public.orders o, jsonb_array_elements(o.items) it
   where o.seller_id = p_seller
     and o.status = 'novo'
     and o.reserved_until > now()
     and (p_exclude is null or o.id <> p_exclude)
   group by 1;
$$;

-- Códigos de p_items que não cabem no disponível (repetidas - reservas de outros pedidos).
create or replace function public.unavailable_codes(p_seller uuid, p_items jsonb, p_exclude uuid default null)
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
    left join public.collection c on c.user_id = p_seller and c.code = i.code
    left join public.reserved_qty(p_seller, p_exclude) r on r.code = i.code
   where greatest(coalesce(c.qty, 0) - 1, 0) - coalesce(r.qty, 0) < i.q;
$$;

-- Cria o pedido de forma atômica (chamado só pelo servidor, com a service_role).
-- Erro 'INDISPONIVEL:CODE1,CODE2' quando alguma figurinha já não está disponível.
create or replace function public.place_order(
  p_seller uuid,
  p_items jsonb,
  p_total_cents int,
  p_buyer jsonb
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

  v_bad := public.unavailable_codes(p_seller, p_items);
  if v_bad is not null then
    raise exception 'INDISPONIVEL:%', array_to_string(v_bad, ',');
  end if;

  return query
  insert into public.orders (
    seller_id, buyer_name, buyer_email, buyer_whatsapp,
    address_cep, address_street, address_number, address_complement,
    address_district, address_city, address_state, items, total_cents
  ) values (
    p_seller, p_buyer->>'name', p_buyer->>'email', p_buyer->>'whatsapp',
    p_buyer->>'cep', p_buyer->>'street', p_buyer->>'number', nullif(p_buyer->>'complement', ''),
    p_buyer->>'district', p_buyer->>'city', p_buyer->>'state', p_items, p_total_cents
  )
  returning orders.id, orders.number, orders.reserved_until;
end;
$$;

revoke execute on function public.place_order(uuid, jsonb, int, jsonb) from public, anon, authenticated;
grant  execute on function public.place_order(uuid, jsonb, int, jsonb) to service_role;

-- Edição dos itens de um pedido novo (pelo dono). p_items = [{ code, qty, unit_cents }].
-- Não estende o prazo de reserva.
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
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'qty', q, 'unit_cents', u) order by code), '[]'::jsonb)
    into v_norm
    from (
      select it->>'code' as code, sum((it->>'qty')::int)::int as q, max((it->>'unit_cents')::int) as u
        from jsonb_array_elements(p_items) it
       group by 1
    ) x
   where q > 0;

  if jsonb_array_length(v_norm) = 0 then
    raise exception 'O pedido precisa ter pelo menos um item — para desistir, cancele o pedido';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_norm) it
     where not exists (select 1 from public.stickers s where s.code = it->>'code')
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

-- Substitui a versão da migração da loja: agora com trava, expiração e cancel_reason.
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
    raise exception 'A reserva deste pedido expirou (5h) — peça ao comprador para refazer o pedido';
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

  update public.orders
     set status = p_status,
         cancel_reason = case when p_status = 'cancelado' then 'manual' else null end,
         updated_at = now()
   where id = p_order_id;
end;
$$;

revoke execute on function public.set_order_status(uuid, text) from public, anon;
grant  execute on function public.set_order_status(uuid, text) to authenticated;

revoke execute on function public.expire_orders(uuid) from public, anon;
grant  execute on function public.expire_orders(uuid) to authenticated, service_role;
