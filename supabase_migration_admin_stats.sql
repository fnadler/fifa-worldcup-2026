-- Migração: agregação das marcações para o painel administrativo (/admin). Idempotente.
-- Opcional: sem ela o painel funciona lendo a tabela collection inteira (lento com muitas contas).
--
-- Uma linha por conta e coleção: itens marcados, unidades repetidas e itens com repetida.
-- Só o servidor (service_role) pode chamar.

create or replace function public.admin_collection_stats()
returns table (user_id uuid, album_id text, itens int, repetidas int, itens_repetidos int)
language sql
stable
security invoker
set search_path = public
as $$
  select c.user_id,
         s.album_id,
         count(*)::int,
         coalesce(sum(greatest(c.qty - 1, 0)), 0)::int,
         (count(*) filter (where c.qty > 1))::int
    from public.collection c
    join public.stickers s on s.code = c.code
   where c.qty > 0
   group by c.user_id, s.album_id;
$$;

revoke execute on function public.admin_collection_stats() from public, anon, authenticated;
grant  execute on function public.admin_collection_stats() to service_role;
