-- Funil da página do lote: quantas pessoas visitam, tocam num pacote, abrem o pedido e enviam o pedido.
-- Uma linha por pessoa (visitante anônimo do navegador) e etapa: conta pessoas, não cliques repetidos.
-- source: de onde veio a primeira visita (email, instagram, whatsapp, facebook, google, site, direto, outro).
-- Só a service_role lê e grava (rota /api/pacotes/[lot]/funil e painel do lojista).

create table if not exists public.pack_lot_events (
  lot_id     uuid        not null references public.pack_lots(id) on delete cascade,
  visitor    text        not null check (char_length(visitor) between 8 and 64),
  step       text        not null check (step in ('view', 'pick', 'checkout', 'order')),
  source     text        not null default 'direto' check (char_length(source) <= 20),
  created_at timestamptz not null default now(),
  primary key (lot_id, visitor, step)
);

create index if not exists pack_lot_events_lot_created on public.pack_lot_events (lot_id, created_at);

alter table public.pack_lot_events enable row level security;
revoke all on public.pack_lot_events from anon, authenticated;
