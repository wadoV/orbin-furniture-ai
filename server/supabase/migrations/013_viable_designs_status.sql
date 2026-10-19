-- 013 — Estado de publicación en la Biblioteca Verificada (aditivo, no destructivo).
-- draft     : generado, pendiente de compuerta automática (no visible al público).
-- validated : pasó validator.js + coherencia (default; las filas existentes ya pasaron el validador).
-- approved  : revisado visualmente por el dueño del producto.
alter table public.viable_designs add column if not exists status text not null default 'validated';
alter table public.viable_designs drop constraint if exists viable_designs_status_check;
alter table public.viable_designs add constraint viable_designs_status_check check (status in ('draft','validated','approved'));
create index if not exists viable_designs_status_idx on public.viable_designs (status);
