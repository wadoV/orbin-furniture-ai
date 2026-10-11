-- 009_create_b2b_leads.sql
create table if not exists public.b2b_leads (
  id             bigint generated always as identity primary key,
  email          text unique not null,
  lead_name      text,
  company        text,
  message        text,
  budget_range   text,
  qualification  text check (qualification in ('HOT','WARM','COLD','PENDING_MANUAL')),
  confidence     numeric,
  needs_review   boolean default false,
  budget_downgraded boolean default false,
  pain_points    jsonb,
  reasoning      text,
  proposal_draft text,
  engine         text,
  model          text,
  scored_at      timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
