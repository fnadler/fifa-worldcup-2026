-- Migração: lotes de pacotes — fase 4: abertura do pacote pelo comprador.
-- Rode no SQL Editor do Supabase depois de supabase_migration_pack_notify.sql. Idempotente.
--
--   • open_pack(token, número): abre um pacote de um pedido confirmado. Sorteia a Legend entre as que
--     ainda estão no pote do lote (dando preferência às que o comprador não tem), grava no pacote e devolve
--     a Legend e as 7 figurinhas. Abrir de novo devolve o mesmo resultado.
--   • Quando o último pacote do lote é aberto, o lote passa para "encerrado".
-- As Legends já saíram do estoque do lojista ao entrar no pote; as 7 figurinhas, na confirmação do pedido.

create or replace function public.open_pack(p_token text, p_number int)
returns table (legend_code text, commons jsonb, opened_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  o       public.orders%rowtype;
  p       public.packs%rowtype;
  v_unit  uuid;
  v_code  text;
  v_now   timestamptz := now();
begin
  select * into o from public.orders where pack_token = p_token;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;
  if o.status <> 'confirmado' then
    raise exception 'PAGAMENTO_PENDENTE';
  end if;

  select * into p from public.packs where order_id = o.id and number = p_number;
  if not found then
    raise exception 'Pacote não encontrado';
  end if;

  -- um sorteio por vez no lote
  perform pg_advisory_xact_lock(hashtext('pack_lot:' || p.lot_id::text));
  select * into p from public.packs where id = p.id for update;

  if p.opened_at is not null then
    return query select p.legend_code, p.commons, p.opened_at;
    return;
  end if;

  select l.id, l.code into v_unit, v_code
    from public.pack_lot_legends l
   where l.lot_id = p.lot_id and l.pack_id is null
   order by exists (
              select 1 from public.collection c
               where o.buyer_user_id is not null and c.user_id = o.buyer_user_id and c.code = l.code and c.qty > 0
            ),
            random()
   limit 1
   for update skip locked;
  if v_unit is null then
    raise exception 'POTE_VAZIO';
  end if;

  update public.pack_lot_legends set pack_id = p.id, drawn_at = v_now where id = v_unit;
  update public.packs set legend_code = v_code, opened_at = v_now where id = p.id;

  if not exists (select 1 from public.packs x where x.lot_id = p.lot_id and x.opened_at is null) then
    update public.pack_lots set status = 'encerrado', updated_at = v_now where id = p.lot_id;
  end if;

  return query select v_code, p.commons, v_now;
end;
$$;

revoke execute on function public.open_pack(text, int) from public, anon, authenticated;
grant  execute on function public.open_pack(text, int) to service_role;
