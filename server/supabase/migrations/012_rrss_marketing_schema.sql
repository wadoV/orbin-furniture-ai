-- 012_rrss_marketing_schema.sql
create table if not exists public.rrss_pillars (
  id bigint generated always as identity primary key,
  topic text not null,
  keywords text,
  status text default 'active',
  last_used_at timestamptz
);

create table if not exists public.rrss_posts (
  id bigint generated always as identity primary key,
  pillar_id bigint references public.rrss_pillars(id),
  status text default 'pending_approval',
  content jsonb,
  engine text, model text,
  decided_by text, decided_at timestamptz, published_at timestamptz,
  created_at timestamptz default now()
);

insert into public.rrss_pillars (topic, keywords) values
 ('Automatización con n8n para PYMEs B2B','n8n, workflows, ahorro de horas'),
 ('Agentes de IA para operaciones','agentes, LLM router, resiliencia'),
 ('Desarrollo web B2B que convierte','landing, conversión, performance')
on conflict do nothing;
