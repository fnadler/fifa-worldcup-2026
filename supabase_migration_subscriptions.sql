-- Migração: assinatura mensal da loja (Stripe)
-- Rode depois das migrações anteriores. Idempotente.
--
-- O acesso à loja continua sendo decidido por shop_entitlements (has_shop_access). O webhook do
-- Stripe chama sync_subscription, que espelha a assinatura em `subscriptions` e ajusta
-- shop_entitlements.expires_at conforme o estado:
--   • trialing / active ........... fim do período + carência (sem carência se o cancelamento está agendado)
--   • past_due (renovação falhou) .. início do período + carência — tempo para o Stripe tentar de novo
--   • canceled / unpaid / incomplete / incomplete_expired / paused ... acesso termina agora e os
--     pedidos pendentes do lojista são cancelados (cancel_reason = 'assinatura')
-- Acessos manuais (source = 'manual', ex: o dono) nunca são rebaixados pelo Stripe.

alter table public.shop_entitlements add column if not exists source text not null default 'manual';
alter table public.shop_entitlements drop constraint if exists shop_entitlements_source_check;
alter table public.shop_entitlements
  add constraint shop_entitlements_source_check check (source in ('manual', 'stripe'));

alter table public.orders drop constraint if exists orders_cancel_reason_check;
alter table public.orders
  add constraint orders_cancel_reason_check check (cancel_reason in ('manual', 'expirado', 'assinatura'));

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text,
  price_id               text,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean not null default false,
  access_until           timestamptz,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "users read their own subscription" on public.subscriptions;
create policy "users read their own subscription"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

-- Log dos eventos do Stripe já processados (auditoria/idempotência). Só o servidor acessa.
create table if not exists public.stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

create or replace function public.sync_subscription(
  p_user uuid,
  p_customer text,
  p_subscription text,
  p_status text,
  p_price text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_trial_end timestamptz,
  p_cancel_at_period_end boolean,
  p_grace_days int default 3
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grace  interval := make_interval(days => p_grace_days);
  v_access timestamptz;
  v_ent    public.shop_entitlements%rowtype;
begin
  v_access := case
    when p_status in ('active', 'trialing') and p_cancel_at_period_end then p_period_end
    when p_status in ('active', 'trialing') then p_period_end + v_grace
    when p_status = 'past_due' then p_period_start + v_grace
    else now()
  end;
  v_access := coalesce(v_access, now());

  insert into public.subscriptions (
    user_id, stripe_customer_id, stripe_subscription_id, status, price_id,
    current_period_start, current_period_end, trial_end, cancel_at_period_end, access_until, updated_at
  ) values (
    p_user, p_customer, p_subscription, p_status, p_price,
    p_period_start, p_period_end, p_trial_end, coalesce(p_cancel_at_period_end, false), v_access, now()
  )
  on conflict (user_id) do update set
    stripe_customer_id     = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    status                 = excluded.status,
    price_id               = excluded.price_id,
    current_period_start   = excluded.current_period_start,
    current_period_end     = excluded.current_period_end,
    trial_end              = excluded.trial_end,
    cancel_at_period_end   = excluded.cancel_at_period_end,
    access_until           = excluded.access_until,
    updated_at             = now();

  select * into v_ent from public.shop_entitlements where user_id = p_user;
  -- acesso manual que já cobre mais tempo (ou é vitalício) prevalece
  if not (found and v_ent.source = 'manual' and (v_ent.expires_at is null or v_ent.expires_at >= v_access)) then
    insert into public.shop_entitlements (user_id, expires_at, note, source)
    values (p_user, v_access, 'assinatura', 'stripe')
    on conflict (user_id) do update
      set expires_at = excluded.expires_at, note = excluded.note, source = excluded.source;
  end if;

  -- Sem nenhum acesso restante: pedidos pendentes são cancelados (ficam no banco com os dados).
  if not public.has_shop_access(p_user) then
    update public.orders
       set status = 'cancelado', cancel_reason = 'assinatura', updated_at = now()
     where seller_id = p_user and status = 'novo';
  end if;

  return v_access;
end;
$$;

revoke execute on function public.sync_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, boolean, int)
  from public, anon, authenticated;
grant  execute on function public.sync_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, boolean, int)
  to service_role;
