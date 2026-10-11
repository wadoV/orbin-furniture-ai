-- 011_b2b_listener_schema.sql
alter table public.b2b_leads
  add column if not exists stopped_reason text,
  add column if not exists replied_at     timestamptz;
