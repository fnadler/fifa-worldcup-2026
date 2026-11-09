-- Numeração de pedidos por lojista.
--
--   • shops.order_prefix: 3 caracteres (A-Z, 0-9) únicos entre as lojas, tirados do endereço da loja
--     (ex: loja-oficial → LOF). Escolhido uma vez e não muda mais, mesmo se a loja trocar de nome.
--   • orders.shop_number: sequência própria de cada loja (1, 2, 3…).
--   • orders.code: o que aparece para lojista e comprador (ex: LOF-001). O orders.number global
--     continua existindo como referência interna.
--
-- Um gatilho preenche shop_number e code em todo insert de pedido, então nenhuma função de pedido
-- precisa mudar. Rode inteiro, uma vez, no SQL Editor do Supabase (é seguro rodar de novo).

alter table public.shops add column if not exists order_prefix text;
alter table public.shops drop constraint if exists shops_order_prefix_format;
alter table public.shops
  add constraint shops_order_prefix_format check (order_prefix is null or order_prefix ~ '^[A-Z0-9]{3}$');
create unique index if not exists shops_order_prefix_key on public.shops (order_prefix);

alter table public.orders add column if not exists shop_number int;
alter table public.orders add column if not exists code text;
create unique index if not exists orders_seller_shop_number_key on public.orders (seller_id, shop_number);

-- Palavras do endereço (ou do nome) da loja, sem acento e sem "de/do/da…": "loja-do-cabeca" → {LOJA,CABECA}.
create or replace function public.order_prefix_words(p_src text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(array(
      select w
      from regexp_split_to_table(
        upper(translate(coalesce(p_src, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
        '[^A-Z0-9]+'
      ) w
      where w <> '' and w not in ('DE', 'DO', 'DA', 'DOS', 'DAS', 'E', 'O', 'A', 'OS', 'AS')
    ), '{}'),
    array['LOJA']
  );
$$;

-- Escolhe (e grava) o prefixo da loja. Primeira opção pelas palavras:
--   1ª palavra com 3 caracteres (uma sigla) → ela mesma (afs-colecoes → AFS);
--   3+ palavras → iniciais das 3 primeiras; 2 → inicial da 1ª + 2 letras da 2ª (loja-oficial → LOF);
--   1 → 3 primeiras letras. Se já existir em outra loja, troca a 3ª letra pelas letras do próprio nome,
--   depois a 2ª e a 3ª por qualquer letra/dígito.
create or replace function public.assign_order_prefix(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_src text;
  w text[];
  v_pool text;
  v_first text;
  v_first2 text;
  v_alpha constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  cand text;
  i int;
  j int;
begin
  -- um prefixo por vez na plataforma toda (evita duas lojas escolherem o mesmo ao mesmo tempo)
  perform pg_advisory_xact_lock(hashtext('order_prefix'));

  select s.order_prefix, coalesce(s.slug, s.seller_name) into v_prefix, v_src
  from public.shops s where s.user_id = p_user;
  if not found then
    raise exception 'loja não encontrada: %', p_user;
  end if;
  if v_prefix is not null then
    return v_prefix;
  end if;

  w := public.order_prefix_words(v_src);
  v_pool := array_to_string(w, '');
  if length(w[1]) = 3 and array_length(w, 1) > 1 then
    cand := w[1];  -- a loja já começa com uma sigla (afs-colecoes → AFS)
  elsif array_length(w, 1) >= 3 then
    cand := left(w[1], 1) || left(w[2], 1) || left(w[3], 1);
  elsif array_length(w, 1) = 2 then
    cand := left(w[1], 1) || rpad(left(w[2], 2), 2, 'X');
  else
    cand := rpad(left(w[1], 3), 3, 'X');
  end if;
  v_first := left(cand, 1);
  v_first2 := left(cand, 2);

  if exists (select 1 from public.shops where order_prefix = cand) then
    cand := null;
    -- mesma inicial e 2ª letra, 3ª tirada do próprio nome
    for i in 1 .. length(v_pool) loop
      if not exists (select 1 from public.shops where order_prefix = v_first2 || substr(v_pool, i, 1)) then
        cand := v_first2 || substr(v_pool, i, 1);
        exit;
      end if;
    end loop;
  end if;

  if cand is null or length(cand) <> 3 then
    cand := null;
    <<busca>>
    for i in 1 .. 36 loop
      for j in 1 .. 36 loop
        if not exists (select 1 from public.shops where order_prefix = v_first || substr(v_alpha, i, 1) || substr(v_alpha, j, 1)) then
          cand := v_first || substr(v_alpha, i, 1) || substr(v_alpha, j, 1);
          exit busca;
        end if;
      end loop;
    end loop;
  end if;

  -- 1.296 prefixos com a mesma inicial ocupados: qualquer combinação livre
  while cand is null loop
    cand := substr(v_alpha, 1 + floor(random() * 26)::int, 1)
         || substr(v_alpha, 1 + floor(random() * 36)::int, 1)
         || substr(v_alpha, 1 + floor(random() * 36)::int, 1);
    if exists (select 1 from public.shops where order_prefix = cand) then
      cand := null;
    end if;
  end loop;

  update public.shops set order_prefix = cand where user_id = p_user;
  return cand;
end;
$$;

revoke execute on function public.assign_order_prefix(uuid) from public, anon, authenticated;
grant  execute on function public.assign_order_prefix(uuid) to service_role;

-- LOF + 7 → LOF-007; a partir de 1000 o número segue inteiro (LOF-1000).
create or replace function public.order_code(p_prefix text, p_n int)
returns text
language sql
immutable
set search_path = public
as $$
  select p_prefix || '-' || lpad(p_n::text, greatest(3, length(p_n::text)), '0');
$$;

-- Gatilho: próximo número da loja e o código do pedido.
create or replace function public.orders_assign_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_n int;
begin
  -- mesma trava que as funções de pedido já usam por loja (reentrante na mesma transação)
  perform pg_advisory_xact_lock(hashtext('orders:' || new.seller_id::text));
  v_prefix := public.assign_order_prefix(new.seller_id);
  select coalesce(max(o.shop_number), 0) + 1 into v_n from public.orders o where o.seller_id = new.seller_id;
  new.shop_number := v_n;
  new.code := public.order_code(v_prefix, v_n);
  return new;
end;
$$;

revoke execute on function public.orders_assign_code() from public, anon, authenticated;

drop trigger if exists orders_assign_code on public.orders;
create trigger orders_assign_code
  before insert on public.orders
  for each row execute function public.orders_assign_code();

-- Lojas e pedidos que já existem. A loja oficial escolhe primeiro; depois quem vende há mais tempo.
do $$
declare
  r record;
begin
  for r in
    select s.user_id
    from public.shops s
    left join lateral (select min(o.created_at) as primeiro from public.orders o where o.seller_id = s.user_id) p on true
    where s.order_prefix is null
    order by (s.slug = 'loja-oficial') desc nulls last, p.primeiro nulls last, s.updated_at
  loop
    perform public.assign_order_prefix(r.user_id);
  end loop;
end;
$$;

-- (pedido de uma loja que não existe mais: prefixo genérico PED)
with numerados as (
  select o.id, row_number() over (partition by o.seller_id order by o.number) as n, coalesce(s.order_prefix, 'PED') as prefixo
  from public.orders o
  left join public.shops s on s.user_id = o.seller_id
  where o.shop_number is null
)
update public.orders o
set shop_number = n.n,
    code = public.order_code(n.prefixo, n.n::int)
from numerados n
where o.id = n.id;

alter table public.orders alter column shop_number set not null;
alter table public.orders alter column code set not null;

-- O lojista não escolhe nem troca o prefixo (é da plataforma): num update feito pelo app logado,
-- o valor antigo volta. assign_order_prefix roda como dono da tabela e passa.
create or replace function public.shops_keep_order_prefix()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.order_prefix is distinct from old.order_prefix and current_user in ('authenticated', 'anon') then
    new.order_prefix := old.order_prefix;
  end if;
  return new;
end;
$$;

drop trigger if exists shops_keep_order_prefix on public.shops;
create trigger shops_keep_order_prefix
  before update on public.shops
  for each row execute function public.shops_keep_order_prefix();
