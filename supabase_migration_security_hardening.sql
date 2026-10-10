-- Migração: correções de segurança (revisão de 2026-10-10). Idempotente.
-- Rode no SQL Editor do Supabase depois das migrações anteriores.

-- 1) View antiga de totais por bloco. Views rodam com as permissões do dono e ignoram o RLS: com a
--    chave pública dava para ler o progresso de todos os usuários. O app não usa mais a view
--    (os totais são calculados no navegador).
drop view if exists public.collection_totals;

-- 2) Imagem da loja: só arquivos do bucket shop-logos, na pasta do próprio lojista. Antes, gravando
--    direto pela API, dava para apontar para qualquer endereço externo (aparece em /lojas).
alter table public.shops drop constraint if exists shops_logo_url_own_bucket;
alter table public.shops
  add constraint shops_logo_url_own_bucket check (
    logo_url is null
    or starts_with(logo_url, 'https://tonzoyloatfuhlrpynjv.supabase.co/storage/v1/object/public/shop-logos/' || user_id::text || '/')
  );

-- 3) Pedidos: o lojista só altera, pela API, as colunas que as funções set_order_status e
--    update_order_items mexem. Dados do comprador, número, vendedor e prazo da reserva ficam
--    protegidos contra edição direta (o servidor, com a service_role, não é afetado).
revoke update on public.orders from authenticated;
grant  update (status, cancel_reason, items, total_cents, updated_at) on public.orders to authenticated;
revoke insert, delete, truncate on public.orders from authenticated, anon;
revoke all on public.orders from anon;
