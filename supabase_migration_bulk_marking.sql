-- Marcação em lote na tela da coleção.
--
--   • collection_bulk_apply: aplica uma quantidade a várias figurinhas de uma coleção, numa transação só.
--       p_mode 'set' → cada uma fica com p_qty (com p_keep_higher, as que já têm mais não diminuem);
--       p_mode 'add' → soma p_qty ao que cada uma já tem (limite de 99).
--     A conta é feita aqui, sobre o valor do banco — um pedido confirmado enquanto a tela estava aberta
--     não é sobrescrito por um número antigo do navegador.
--   • collection_bulk_restore: grava valores exatos por figurinha (o "Desfazer" do lote).
--
-- As duas devolvem só o que mudou, num objeto só ({"codes":[…],"old":[…],"new":[…]} — uma lista de linhas
-- seria cortada no limite de 1000 da API), aceitam apenas códigos
-- da coleção informada e só mexem na conta de quem chama (security invoker + auth.uid(), com RLS).
-- Quantidade 0 apaga a linha, como a marcação individual faz.
--
-- Rode inteiro, uma vez, no SQL Editor do Supabase (é seguro rodar de novo).

drop function if exists public.collection_bulk_apply(text, text[], text, int, boolean);
drop function if exists public.collection_bulk_restore(text, text[], int[]);

create or replace function public.collection_bulk_apply(
  p_album_id    text,
  p_codes       text[],
  p_mode        text,
  p_qty         int,
  p_keep_higher boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  r      record;
  v_new  int;
  v_code text[] := '{}';
  v_old  int[] := '{}';
  v_nov  int[] := '{}';
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;
  if p_mode is null or p_mode not in ('set', 'add') then
    raise exception 'Modo inválido';
  end if;
  if p_qty is null or p_qty < 0 or p_qty > 99 or (p_mode = 'add' and p_qty < 1) then
    raise exception 'Quantidade inválida';
  end if;
  if coalesce(cardinality(p_codes), 0) = 0 then
    return jsonb_build_object('codes', '[]'::jsonb, 'old', '[]'::jsonb, 'new', '[]'::jsonb);
  end if;
  if cardinality(p_codes) > 5000 then
    raise exception 'Itens demais de uma vez';
  end if;

  -- trava as linhas que já existem (pedido confirmado ao mesmo tempo espera ou é esperado)
  perform 1 from public.collection c where c.user_id = v_uid and c.code = any (p_codes) order by c.code for update;

  for r in
    select s.code, coalesce(c.qty, 0) as cur
      from public.stickers s
      left join public.collection c on c.user_id = v_uid and c.code = s.code
     where s.album_id = p_album_id
       and s.code = any (p_codes)
     order by s.code
  loop
    if p_mode = 'add' then
      v_new := least(99, r.cur + p_qty);
    elsif p_keep_higher then
      v_new := greatest(r.cur, p_qty);
    else
      v_new := p_qty;
    end if;

    continue when v_new = r.cur;

    if v_new = 0 then
      delete from public.collection c where c.user_id = v_uid and c.code = r.code;
    else
      insert into public.collection as c (user_id, code, qty, updated_at)
      values (v_uid, r.code, v_new, now())
      on conflict (user_id, code) do update set qty = excluded.qty, updated_at = now();
    end if;

    v_code := v_code || r.code;
    v_old := v_old || r.cur;
    v_nov := v_nov || v_new;
  end loop;

  return jsonb_build_object('codes', to_jsonb(v_code), 'old', to_jsonb(v_old), 'new', to_jsonb(v_nov));
end;
$$;

revoke execute on function public.collection_bulk_apply(text, text[], text, int, boolean) from public, anon;
grant  execute on function public.collection_bulk_apply(text, text[], text, int, boolean) to authenticated;

create or replace function public.collection_bulk_restore(
  p_album_id text,
  p_codes    text[],
  p_qtys     int[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  r      record;
  v_code text[] := '{}';
  v_old  int[] := '{}';
  v_nov  int[] := '{}';
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;
  if coalesce(cardinality(p_codes), 0) = 0 then
    return jsonb_build_object('codes', '[]'::jsonb, 'old', '[]'::jsonb, 'new', '[]'::jsonb);
  end if;
  if cardinality(p_codes) > 5000 or cardinality(p_codes) <> coalesce(cardinality(p_qtys), 0) then
    raise exception 'Lista inválida';
  end if;
  if exists (select 1 from unnest(p_qtys) q where q is null or q < 0 or q > 99) then
    raise exception 'Quantidade inválida';
  end if;

  perform 1 from public.collection c where c.user_id = v_uid and c.code = any (p_codes) order by c.code for update;

  for r in
    select distinct on (s.code) s.code, coalesce(c.qty, 0) as cur, v.qty as target
      from unnest(p_codes, p_qtys) as v(code, qty)
      join public.stickers s on s.code = v.code and s.album_id = p_album_id
      left join public.collection c on c.user_id = v_uid and c.code = s.code
     order by s.code
  loop
    continue when r.target = r.cur;

    if r.target = 0 then
      delete from public.collection c where c.user_id = v_uid and c.code = r.code;
    else
      insert into public.collection as c (user_id, code, qty, updated_at)
      values (v_uid, r.code, r.target, now())
      on conflict (user_id, code) do update set qty = excluded.qty, updated_at = now();
    end if;

    v_code := v_code || r.code;
    v_old := v_old || r.cur;
    v_nov := v_nov || r.target;
  end loop;

  return jsonb_build_object('codes', to_jsonb(v_code), 'old', to_jsonb(v_old), 'new', to_jsonb(v_nov));
end;
$$;

revoke execute on function public.collection_bulk_restore(text, text[], int[]) from public, anon;
grant  execute on function public.collection_bulk_restore(text, text[], int[]) to authenticated;
