-- Migração: várias coleções (Fase 3 — loja). Rode depois de supabase_migration_collections_phase2.sql.
-- Idempotente.
--
--   • shop_albums passa a valer: preço por grupo, pedido mínimo e "à venda" por coleção.
--     Recopia de shops os valores do Álbum Copa (até aqui a loja gravava em shops) e cria a linha
--     do Álbum Copa para lojas abertas depois da Fase 1. Lojas novas ganham a linha por trigger.
--   • Carrinho por coleção: a chave de cart_holds inclui album_id; hold_cart e place_order recebem
--     p_album (padrão Álbum Copa — chamadas antigas continuam funcionando durante o deploy).
--   • place_order grava a coleção do pedido em orders.album_id.

-- ---------- shop_albums ----------
insert into public.shop_albums (user_id, album_id, min_order_cents, group_prices)
select s.user_id, 'wc2026-panini', s.min_order_cents,
       jsonb_strip_nulls(jsonb_build_object(
         'FWC', s.price_fwc_cents, 'TEAM', s.price_team_cents,
         'CC',  s.price_cc_cents,  'LEG',  s.price_leg_cents))
  from public.shops s
on conflict (user_id, album_id) do update
  set min_order_cents = excluded.min_order_cents,
      group_prices    = excluded.group_prices,
      updated_at      = now();

create or replace function public.handle_new_shop_album()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.shop_albums (user_id, album_id, min_order_cents)
  values (new.user_id, 'wc2026-panini', new.min_order_cents)
  on conflict (user_id, album_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_shop_created_album on public.shops;
create trigger on_shop_created_album
  after insert on public.shops
  for each row execute function public.handle_new_shop_album();

-- ---------- carrinho por coleção ----------
alter table public.cart_holds drop constraint if exists cart_holds_pkey;
alter table public.cart_holds add primary key (cart_id, seller_id, album_id);

drop function if exists public.hold_cart(uuid, uuid, jsonb, int);

create or replace function public.hold_cart(
  p_seller uuid,
  p_cart_id uuid,
  p_items jsonb,
  p_minutes int default 10,
  p_album text default 'wc2026-panini'
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
      -- reserved_qty ignora TODOS os carrinhos deste navegador com o vendedor; como os códigos são
      -- únicos por coleção, o carrinho de outra coleção não tem estes códigos.
      left join public.reserved_qty(p_seller, null, p_cart_id) r on r.code = p.code
  )
  select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'qty', a.q) order by a.code), '[]'::jsonb)
    into v_items
    from ajustado a
   where a.q > 0;

  if jsonb_array_length(v_items) = 0 then
    delete from public.cart_holds where cart_id = p_cart_id and seller_id = p_seller and album_id = p_album;
    return query select '[]'::jsonb, null::timestamptz;
    return;
  end if;

  select h.expires_at into v_prev
    from public.cart_holds h
   where h.cart_id = p_cart_id and h.seller_id = p_seller and h.album_id = p_album;
  -- prazo fixo a partir do primeiro item; vencido (ou inexistente), abre um novo
  v_exp := case when v_prev is not null and v_prev > now() then v_prev else now() + make_interval(mins => p_minutes) end;

  insert into public.cart_holds (cart_id, seller_id, album_id, items, expires_at, updated_at)
  values (p_cart_id, p_seller, p_album, v_items, v_exp, now())
  on conflict (cart_id, seller_id, album_id) do update
    set items = excluded.items, expires_at = excluded.expires_at, updated_at = now();

  return query select v_items, v_exp;
end;
$$;

revoke execute on function public.hold_cart(uuid, uuid, jsonb, int, text) from public, anon, authenticated;
grant  execute on function public.hold_cart(uuid, uuid, jsonb, int, text) to service_role;

drop function if exists public.place_order(uuid, jsonb, int, jsonb, uuid);

create or replace function public.place_order(
  p_seller uuid,
  p_items jsonb,
  p_total_cents int,
  p_buyer jsonb,
  p_cart_id uuid default null,
  p_album text default 'wc2026-panini'
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
    delete from public.cart_holds where cart_id = p_cart_id and seller_id = p_seller and album_id = p_album;
  end if;

  return query
  insert into public.orders (
    seller_id, album_id, buyer_name, buyer_email, buyer_whatsapp,
    address_cep, address_street, address_number, address_complement,
    address_district, address_city, address_state, items, total_cents
  ) values (
    p_seller, p_album, p_buyer->>'name', p_buyer->>'email', p_buyer->>'whatsapp',
    p_buyer->>'cep', p_buyer->>'street', p_buyer->>'number', nullif(p_buyer->>'complement', ''),
    p_buyer->>'district', p_buyer->>'city', p_buyer->>'state', p_items, p_total_cents
  )
  returning orders.id, orders.number, orders.reserved_until;
end;
$$;

revoke execute on function public.place_order(uuid, jsonb, int, jsonb, uuid, text) from public, anon, authenticated;
grant  execute on function public.place_order(uuid, jsonb, int, jsonb, uuid, text) to service_role;
