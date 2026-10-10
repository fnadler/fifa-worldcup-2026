-- Migração: convite por e-mail para o grupo de WhatsApp da comunidade. Idempotente.
--
-- Uma linha por conta que já recebeu o convite (lib/communityInvite.ts). Só o servidor (service role)
-- lê e grava — RLS ligado, sem políticas.

create table if not exists public.community_invites (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  sent_at  timestamptz not null default now(),
  email_id text                                   -- id do envio no Resend
);

alter table public.community_invites enable row level security;
