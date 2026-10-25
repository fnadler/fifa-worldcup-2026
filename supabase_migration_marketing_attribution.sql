-- Migração: atribuição de marketing (UTM/fbclid de quem se cadastrou) e funil por anúncio. Idempotente.
-- Rode no SQL Editor do Supabase. Enquanto não rodar, o cadastro e o webhook funcionam normalmente
-- (só não guardam a atribuição).
--
-- Uma linha por conta, gravada ao confirmar o e-mail (/auth/callback ou /auth/confirm) com o que o
-- cadastro guardou em user_metadata.attr. Guarda a PRIMEIRA atribuição: não é sobrescrita depois.
-- paid_at: primeira fatura com valor pago (gravado pelo webhook do Stripe, em invoice.paid).
-- Só o servidor (service_role) lê e escreve.

create table if not exists public.marketing_attribution (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  utm_source    text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  fbclid        text, fbc text, fbp text,
  landing_path  text,
  client_ip     text, user_agent text,
  created_at    timestamptz not null default now()
);

alter table public.marketing_attribution add column if not exists paid_at timestamptz;

alter table public.marketing_attribution enable row level security;
-- sem policies: só o service role lê e escreve
revoke all on public.marketing_attribution from anon, authenticated;

-- Funil por campanha + criativo (utm_campaign + utm_content). Cadastros sem UTM aparecem como
-- "(sem campanha)" / "(sem criativo)".
--   cadastros ..... linhas em marketing_attribution
--   testes ........ assinatura com teste grátis (subscriptions.trial_end preenchido)
--   pagantes ...... primeira fatura paga registrada (paid_at) ou, para quem pagou antes desta
--                   migração, assinatura ativa já cobrada depois do fim do teste (ou sem teste)
create or replace view public.marketing_funnel
with (security_invoker = true) as
select
  coalesce(nullif(a.utm_campaign, ''), '(sem campanha)') as utm_campaign,
  coalesce(nullif(a.utm_content, ''), '(sem criativo)')  as utm_content,
  count(*)::int                                          as cadastros,
  count(*) filter (where s.trial_end is not null)::int   as testes,
  count(*) filter (
    where a.paid_at is not null
       or (s.status = 'active' and (s.trial_end is null or s.current_period_start >= s.trial_end))
  )::int                                                 as pagantes,
  min(a.created_at)                                      as primeiro_cadastro,
  max(a.created_at)                                      as ultimo_cadastro
from public.marketing_attribution a
left join public.subscriptions s on s.user_id = a.user_id
group by 1, 2;

revoke all on public.marketing_funnel from public, anon, authenticated;
grant select on public.marketing_funnel to service_role;
