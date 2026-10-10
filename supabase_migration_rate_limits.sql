-- Migração: limite de uso por IP nas rotas públicas da loja (carrinho e pedido). Idempotente.
-- Rode no SQL Editor do Supabase. Enquanto não rodar, o site funciona sem o limite (lib/rateLimit.ts).
--
-- Contagem em janelas fixas: uma linha por chave + início da janela. A chave é "<regra>:<resumo do IP>"
-- (o IP em si não é guardado). Só o servidor (service_role) lê e escreve.

create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         int         not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

-- Conta uma chamada e devolve true se ela ainda cabe no limite da janela atual.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits  int;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- limpeza: de vez em quando apaga janelas antigas (a maior janela usada é de 1 dia)
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_hits <= p_max;
end;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant  execute on function public.rate_limit_hit(text, int, int) to service_role;
