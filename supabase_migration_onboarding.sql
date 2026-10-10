-- Migração: escolha das coleções depois do cadastro (onboarding). Idempotente.
-- Rode depois de supabase_migration_collections.sql.
--
-- Antes, toda conta nova ganhava uma coleção na criação (a escolhida no cadastro, ou o Álbum Copa).
-- Agora o cadastro grava onboarding = 'pending' no user_metadata e a pessoa escolhe as coleções na tela
-- /colecoes/comecar — o gatilho deixa de criar a coleção nesses casos. Cadastros sem a marca seguem como antes.

create or replace function public.handle_new_user_album()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_album text := new.raw_user_meta_data->>'album_id';
begin
  if new.raw_user_meta_data->>'onboarding' = 'pending' then
    return new;
  end if;
  if v_album is null or not exists (select 1 from public.albums a where a.id = v_album and a.active) then
    v_album := 'wc2026-panini';
  end if;
  insert into public.user_albums (user_id, album_id, collection_name)
  values (new.id, v_album, nullif(btrim(new.raw_user_meta_data->>'collection_name'), ''))
  on conflict (user_id, album_id) do nothing;
  return new;
end;
$$;
