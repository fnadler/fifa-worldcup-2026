-- Correção: pedido de pacotes sem login falhava com "permission denied for table users".
-- place_pack_order procura a conta do comprador pelo e-mail em auth.users, e o service_role não lê
-- essa tabela. A função passa a rodar como dona (security definer). Continua executável só pelo
-- service_role (grants da migração pack_orders), então nada muda para anon/authenticated.
alter function public.place_pack_order(uuid, uuid, int[], jsonb, uuid) security definer;
