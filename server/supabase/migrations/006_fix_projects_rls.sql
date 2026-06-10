-- ================================================================
-- Orbin AI — Endurecer RLS de projects (reemplaza el allow-all del MVP)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Contexto: la migración 001 dejó la policy temporal `allow_all_mvp`
-- (FOR ALL USING(true)), que permite a CUALQUIER cliente con la anon key
-- leer/editar/borrar TODOS los proyectos vía PostgREST. El servidor usa la
-- service_role key (ignora RLS), por lo que esta migración NO lo afecta;
-- solo bloquea el acceso directo no autorizado.
-- ================================================================

-- 1. Asegurar columna de propietario (UUID del usuario de Supabase Auth)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects (owner_id);

-- 2. Quitar la policy abierta del MVP
DROP POLICY IF EXISTS "allow_all_mvp" ON public.projects;

-- 3. Policies por propietario (solo el dueño autenticado accede a sus filas)
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "projects_delete_own" ON public.projects;
CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- 4. Revocar el acceso anónimo directo (defensa en profundidad)
REVOKE ALL ON public.projects FROM anon;

-- Verificación
SELECT 'projects RLS endurecido por propietario ✓' AS status;
