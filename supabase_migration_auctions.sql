-- Migração: leilões da comunidade (controle pelo /admin).
-- Rode no SQL Editor do Supabase depois das migrações anteriores. Idempotente.
--
--   • auctions: um registro por leilão — data, regras (tempo por lote, prorrogação, incremento),
--     Pix, frete e o texto de divulgação. As mensagens do grupo são geradas a partir daqui.
--   • auction_lots: os lotes de cada leilão, na ordem em que são apresentados, com foto, estimativa,
--     lance inicial e o resultado (valor e arrematante).
--   • auction_bidders: os arrematantes, identificados pelo WhatsApp (só dígitos, com 55). O mesmo
--     número é a mesma pessoa em todos os leilões. user_id fica vazio por enquanto: só será ligado
--     a uma conta quando o número for confirmado (área "Meus arremates", futura).
--   • auction_settlements: pagamento e envio de cada arrematante em cada leilão (um Pix e um pacote
--     por pessoa, mesmo com vários lotes): pago em, enviado em, entregue em, código e link de rastreio.
--
-- Acesso: RLS ligado e nenhuma política — só o servidor (service_role) lê e grava, depois de checar
-- que quem pede é o admin da plataforma. As fotos ficam num bucket PRIVADO (os lotes não podem vazar
-- antes do leilão); a página mostra cada uma por link assinado, temporário.

-- ---------- arrematantes ----------
create table if not exists public.auction_bidders (
  id          uuid primary key default gen_random_uuid(),
  whatsapp    text not null unique check (whatsapp ~ '^55[1-9]{2}[0-9]{8,9}$'),
  name        text not null default '' check (char_length(name) <= 80),
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- leilões ----------
create table if not exists public.auctions (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(btrim(title)) between 2 and 80),
  starts_at           timestamptz not null,
  status              text not null default 'rascunho'
                        check (status in ('rascunho', 'agendado', 'ao_vivo', 'encerrado')),
  lot_minutes         int  not null default 3    check (lot_minutes between 1 and 30),
  extension_minutes   int  not null default 1    check (extension_minutes between 1 and 10),
  min_increment_cents int  not null default 1000 check (min_increment_cents between 100 and 100000),
  pix_key             text not null default ''   check (char_length(pix_key) <= 120),
  pix_deadline_hours  int  not null default 24   check (pix_deadline_hours between 1 and 168),
  shipping_note       text not null default ''   check (char_length(shipping_note) <= 300),
  announcement        text not null default ''   check (char_length(announcement) <= 4000),
  current_lot_id      uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists auctions_starts_idx on public.auctions (starts_at desc);

-- ---------- lotes ----------
create table if not exists public.auction_lots (
  id                  uuid primary key default gen_random_uuid(),
  auction_id          uuid not null references public.auctions(id) on delete cascade,
  position            int  not null default 0,
  name                text not null check (char_length(btrim(name)) between 2 and 80),
  detail              text not null default '' check (char_length(detail) <= 300),
  estimate_min_cents  int  check (estimate_min_cents between 0 and 10000000),
  estimate_max_cents  int  check (estimate_max_cents between 0 and 10000000),
  start_cents         int  not null check (start_cents between 0 and 10000000),
  image_path          text check (image_path is null or starts_with(image_path, auction_id::text || '/')),
  status              text not null default 'aguardando'
                        check (status in ('aguardando', 'aberto', 'arrematado', 'sem_lance')),
  opened_at           timestamptz,
  closes_at           timestamptz,
  sold_cents          int  check (sold_cents between 0 and 10000000),
  bidder_id           uuid references public.auction_bidders(id) on delete restrict,
  closed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint auction_lots_estimate_order check (
    estimate_min_cents is null or estimate_max_cents is null or estimate_min_cents <= estimate_max_cents
  ),
  -- arrematado ⇔ tem valor e arrematante
  constraint auction_lots_sold_has_result check (
    (status = 'arrematado') = (sold_cents is not null and bidder_id is not null)
  )
);

create index if not exists auction_lots_auction_idx on public.auction_lots (auction_id, position);
create index if not exists auction_lots_bidder_idx  on public.auction_lots (bidder_id) where bidder_id is not null;

-- Lote atual do painel ao vivo: precisa ser um lote do próprio leilão.
alter table public.auctions drop constraint if exists auctions_current_lot_fk;
alter table public.auction_lots drop constraint if exists auction_lots_id_auction_key;
alter table public.auction_lots add constraint auction_lots_id_auction_key unique (id, auction_id);
alter table public.auctions
  add constraint auctions_current_lot_fk foreign key (current_lot_id, id)
  references public.auction_lots (id, auction_id) on delete set null (current_lot_id);

-- ---------- pagamento e envio, por arrematante e leilão ----------
create table if not exists public.auction_settlements (
  auction_id     uuid not null references public.auctions(id) on delete cascade,
  bidder_id      uuid not null references public.auction_bidders(id) on delete restrict,
  paid_at        timestamptz,
  shipped_at     timestamptz,
  delivered_at   timestamptz,
  tracking_code  text not null default '' check (char_length(tracking_code) <= 60),
  tracking_url   text not null default '' check (tracking_url = '' or tracking_url ~ '^https?://' and char_length(tracking_url) <= 500),
  notes          text not null default '' check (char_length(notes) <= 500),
  updated_at     timestamptz not null default now(),
  primary key (auction_id, bidder_id)
);

-- ---------- acesso: só o servidor ----------
alter table public.auctions            enable row level security;
alter table public.auction_lots        enable row level security;
alter table public.auction_bidders     enable row level security;
alter table public.auction_settlements enable row level security;

revoke all on public.auctions, public.auction_lots, public.auction_bidders, public.auction_settlements from anon, authenticated;

-- ---------- fotos dos lotes (bucket privado) ----------
-- Sem políticas em storage.objects: só a service_role envia, apaga e gera links assinados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('auction-lots', 'auction-lots', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
