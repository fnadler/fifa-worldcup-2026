-- CPF do comprador no pedido (pedido pelas transportadoras: Correios, Superfrete, Loggi…).
-- Gravado pela API do pedido (service role) junto com buyer_ack_at; o lojista lê pelo RLS de orders.
-- Pedidos antigos ficam sem CPF. Rode uma vez no SQL Editor do Supabase (é seguro rodar de novo).

alter table public.orders add column if not exists buyer_cpf text;
alter table public.orders drop constraint if exists orders_buyer_cpf_format;
alter table public.orders
  add constraint orders_buyer_cpf_format check (buyer_cpf is null or buyer_cpf ~ '^[0-9]{11}$');
