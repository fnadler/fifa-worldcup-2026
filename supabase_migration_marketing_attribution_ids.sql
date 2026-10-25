-- Migração: IDs da Meta e primeiro toque na atribuição do cadastro. Idempotente.
-- Rode no SQL Editor do Supabase depois de supabase_migration_marketing_attribution.sql. Enquanto não
-- rodar, o upsert do cadastro falha (coluna inexistente) e só registra no log; o cadastro segue normal.
--
-- utm_campaign_id / utm_adset_id / utm_ad_id: IDs vindos dos "Parâmetros de URL" do anúncio
-- ({{campaign.id}}, {{adset.id}}, {{ad.id}}). A atribuição usa os IDs, não os nomes.
-- ftp_*: primeiro toque (cookie gn_attr_ft, gravado na primeira visita com atribuição e nunca
-- sobrescrito); utm_* continua sendo o último toque antes do cadastro.

alter table public.marketing_attribution
  add column if not exists utm_campaign_id     text,
  add column if not exists utm_adset_id        text,
  add column if not exists utm_ad_id           text,
  add column if not exists ftp_utm_source      text,
  add column if not exists ftp_utm_medium      text,
  add column if not exists ftp_utm_campaign    text,
  add column if not exists ftp_utm_content     text,
  add column if not exists ftp_utm_campaign_id text,
  add column if not exists ftp_utm_adset_id    text,
  add column if not exists ftp_utm_ad_id       text,
  add column if not exists ftp_landing_path    text,
  add column if not exists ftp_at              timestamptz;

create index if not exists marketing_attribution_utm_ad_id_idx on public.marketing_attribution (utm_ad_id);
