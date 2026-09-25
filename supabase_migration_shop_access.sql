-- Migração: acesso à loja (vitrine) só para usuários habilitados
-- Rode depois de supabase_migration_shop.sql.
--
-- Quem tem uma linha ativa aqui pode usar /vendas e ter a loja pública.
-- Gestão por enquanto: Supabase → Table Editor → shop_entitlements (inserir/remover linhas).
-- No futuro, o webhook do meio de pagamento grava aqui (com expires_at para assinaturas).

create table if not exists public.shop_entitlements (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz,               -- null = sem vencimento
  note       text,                      -- ex: "dono", "teste", "plano mensal"
  created_at timestamptz not null default now()
);

alter table public.shop_entitlements enable row level security;

-- O usuário só consegue LER a própria linha. Não há policy de escrita: só o
-- dashboard / service_role (webhook de pagamento, no futuro) concede acesso.
create policy "users read their own entitlement"
  on public.shop_entitlements for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.has_shop_access(p_user uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.shop_entitlements
     where user_id = p_user and (expires_at is null or expires_at > now())
  );
$$;

-- Defesa em profundidade: sem acesso ativo, o usuário não cria/edita loja nem preços
-- mesmo chamando a API do Supabase diretamente.
drop policy if exists "users manage their own shop" on public.shops;
create policy "users manage their own shop"
  on public.shops for all to authenticated
  using (auth.uid() = user_id and public.has_shop_access(auth.uid()))
  with check (auth.uid() = user_id and public.has_shop_access(auth.uid()));

drop policy if exists "users manage their own prices" on public.sticker_prices;
create policy "users manage their own prices"
  on public.sticker_prices for all to authenticated
  using (auth.uid() = user_id and public.has_shop_access(auth.uid()))
  with check (auth.uid() = user_id and public.has_shop_access(auth.uid()));

-- Habilite você mesmo (troque o e-mail) — rode uma vez:
-- insert into public.shop_entitlements (user_id, note)
-- select id, 'dono' from auth.users where email = 'SEU_EMAIL_AQUI'
-- on conflict (user_id) do nothing;
