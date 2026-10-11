-- 010_b2b_nurture_schema.sql
alter table public.b2b_leads
  add column if not exists nurture_status  text,
  add column if not exists nurture_stage   int  default 0,
  add column if not exists next_action_at  timestamptz,
  add column if not exists last_action_at  timestamptz;

create index if not exists idx_leads_nurture_due
  on public.b2b_leads (nurture_status, next_action_at);

create table if not exists public.nurture_tasks (
  id         bigint generated always as identity primary key,
  lead_id    bigint references public.b2b_leads(id),
  email      text,
  company    text,
  step_key   text,
  action     text,
  status     text default 'open',
  created_at timestamptz default now()
);
