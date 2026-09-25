-- Migração: reserva do carrinho (10 min) + reserva de pedidos passa a 24h
-- Rode depois de supabase_migration_order_reservations.sql. Idempotente.
--
-- Regras:
--   • Cada navegador tem um cart_id (cookie). Ao mexer no carrinho, hold_cart reserva os itens
--     atomicamente, ajustando ao que estiver disponível. O prazo (10 min) conta a partir do
--     primeiro item e NÃO renova a cada alteração; vencido, a próxima alteração abre um novo prazo.
--   • Reservado = pedidos novos dentro do prazo + carrinhos ativos (expires_at > now()).
--   • place_order ignora o carrinho do próprio comprador na checagem e o apaga ao virar pedido.
--   • Pedidos novos passam a reservar por 24h (pedidos já existentes mantêm o prazo deles).

alter table public.orders alter column reserved_until set default (now() + interval '24 hours');

create table if not exists public.cart_holds (
  cart_id    uuid not null,
  seller_id  uuid not null references auth.users(id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,       -- [{ code, qty }]
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (cart_id, seller_id)
);

create index if not exists cart_holds_seller_idx on public.cart_holds(seller_id, expires_at);

-- Sem policies: só o servidor (service_role) lê/escreve carrinhos.
alter table public.cart_holds enable row level security;

-- As assinaturas mudam (novos parâmetros opcionais): remove as antigas para não haver
-- ambiguidade de sobrecarga. As funções que as chamam resolvem pelo nome em tempo de execução.
drop function if exists public.place_order(uuid, jsonb, int, jsonb);
drop function if exists public.unavailable_codes(uuid, jsonb, uuid);
drop function if exists public.reserved_qty(uuid, uuid);

-- Reservado por código: pedidos novos no prazo + carrinhos ativos, podendo ignorar um pedido
-- (edição) e/ou um carrinho (o do próprio comprador).
-- security definer: carrinhos não são visíveis por RLS, mas precisam contar também quando o
-- dono edita um pedido. Só expõe quantidades agregadas.
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
        from public.orders o, jsonb_array_elements(o.items) it
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
    left join public.collection c on c.user_id = p_seller and c.code = i.code
    left join public.reserved_qty(p_seller, p_exclude_order, p_exclude_cart) r on r.code = i.code
   where greatest(coalesce(c.qty, 0) - 1, 0) - coalesce(r.qty, 0) < i.q;
$$;

-- Reserva (ou atualiza) o carrinho, ajustando cada item ao disponível para este carrinho.
-- Retorna os itens efetivamente reservados e o fim do prazo (null se o carrinho ficou vazio).
create or replace function public.hold_cart(
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
  delete from public.cart_holds where seller_id = p_seller and cart_holds.expires_at < now() - interval '1 day';

  with pedido as (
    select it->>'code' as code, sum((it->>'qty')::int)::int as q
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
     group by 1
  ), ajustado as (
    select p.code,
           least(p.q, greatest(greatest(coalesce(c.qty, 0) - 1, 0) - coalesce(r.qty, 0), 0)) as q
      from pedido p
      left join public.collection c on c.user_id = p_seller and c.code = p.code
      left join public.reserved_qty(p_seller, null, p_cart_id) r on r.code = p.code
  )
  select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'qty', a.q) order by a.code), '[]'::jsonb)
    into v_items
    from ajustado a
   where a.q > 0;

  if jsonb_array_length(v_items) = 0 then
    delete from public.cart_holds where cart_id = p_cart_id and seller_id = p_seller;
    return query select '[]'::jsonb, null::timestamptz;
    return;
  end if;

  select h.expires_at into v_prev from public.cart_holds h where h.cart_id = p_cart_id and h.seller_id = p_seller;
  -- prazo fixo a partir do primeiro item; vencido (ou inexistente), abre um novo
  v_exp := case when v_prev is not null and v_prev > now() then v_prev else now() + make_interval(mins => p_minutes) end;

  insert into public.cart_holds (cart_id, seller_id, items, expires_at, updated_at)
  values (p_cart_id, p_seller, v_items, v_exp, now())
  on conflict (cart_id, seller_id) do update
    set items = excluded.items, expires_at = excluded.expires_at, updated_at = now();

  return query select v_items, v_exp;
end;
$$;

revoke execute on function public.hold_cart(uuid, uuid, jsonb, int) from public, anon, authenticated;
grant  execute on function public.hold_cart(uuid, uuid, jsonb, int) to service_role;

-- Cria o pedido de forma atômica. O carrinho do próprio comprador (p_cart_id) não conta como
-- reserva de terceiros e é apagado quando vira pedido.
create or replace function public.place_order(
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
    delete from public.cart_holds where cart_id = p_cart_id and seller_id = p_seller;
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

revoke execute on function public.place_order(uuid, jsonb, int, jsonb, uuid) from public, anon, authenticated;
grant  execute on function public.place_order(uuid, jsonb, int, jsonb, uuid) to service_role;

-- Mensagem de pedido expirado sem citar o número de horas (agora 24h).
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
    raise exception 'A reserva deste pedido expirou — peça ao comprador para refazer o pedido';
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
