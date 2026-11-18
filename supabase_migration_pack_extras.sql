-- Migração: lotes de pacotes — fase 5: marcar na coleção e lembrete de pacote fechado.
-- Rode no SQL Editor do Supabase depois de supabase_migration_pack_open.sql. Idempotente.
--
--   • packs.collected_at: quando as 8 figurinhas do pacote foram marcadas na coleção do comprador
--     (uma vez por pacote).
--   • orders.packs_reminders / packs_reminded_at: lembretes "você ainda tem pacotes fechados" enviados.
--   • pack_add_to_collection(token, conta): soma +1 de cada figurinha dos pacotes abertos (e ainda não
--     marcados) na coleção da conta e garante que ela acompanha o Álbum Copa 2026.

alter table public.packs  add column if not exists collected_at      timestamptz;
alter table public.orders add column if not exists packs_reminders   int not null default 0;
alter table public.orders add column if not exists packs_reminded_at timestamptz;

create or replace function public.pack_add_to_collection(p_token text, p_user uuid)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  o     public.orders%rowtype;
  v_n   int := 0;
  r     record;
begin
  select * into o from public.orders where pack_token = p_token and status = 'confirmado';
  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  perform pg_advisory_xact_lock(hashtext('collect:' || o.id::text));

  for r in
    select c.code, count(*)::int as q
      from public.packs p,
           lateral (select jsonb_array_elements_text(p.commons) as code union all select p.legend_code) c
     where p.order_id = o.id and p.opened_at is not null and p.collected_at is null and c.code is not null
     group by c.code
  loop
    insert into public.collection (user_id, code, qty, updated_at)
    values (p_user, r.code, least(99, r.q), now())
    on conflict (user_id, code) do update
      set qty = least(99, public.collection.qty + excluded.qty), updated_at = now();
    v_n := v_n + r.q;
  end loop;

  update public.packs set collected_at = now()
   where order_id = o.id and opened_at is not null and collected_at is null;

  insert into public.user_albums (user_id, album_id)
  values (p_user, 'wc2026-panini')
  on conflict (user_id, album_id) do nothing;

  return v_n;
end;
$$;

revoke execute on function public.pack_add_to_collection(text, uuid) from public, anon, authenticated;
grant  execute on function public.pack_add_to_collection(text, uuid) to service_role;
