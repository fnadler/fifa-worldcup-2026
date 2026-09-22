-- Migração: link público de visualização (somente leitura) da coleção
-- Rode isto no SQL Editor do Supabase depois do supabase_schema.sql original.

create table if not exists public.collection_shares (
  token      text primary key,
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.collection_shares enable row level security;

-- O dono pode ver/criar/apagar só o próprio token (usado pelo botão "Compartilhar").
-- Não existe nenhuma policy para o papel anon aqui de propósito: a leitura pública
-- do token é feita só no servidor, via service_role key, que ignora RLS.
create policy "users manage their own share token"
  on public.collection_shares for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
