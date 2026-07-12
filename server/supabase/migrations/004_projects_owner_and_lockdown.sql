-- ================================================================
-- Orbin AI — Migration 004: projects owner_id + lockdown de seguridad
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de 001–003)
--
-- Corrige DOS problemas antes de producción:
--  1) El server (server/src/routes/projects.js) escribe y filtra por
--     `owner_id = req.user.id`, pero 001 no creaba esa columna → guardar
--     proyectos fallaba con "column owner_id does not exist".
--  2) 001 dejó una policy MVP `allow_all_mvp` (FOR ALL USING true) que da
--     acceso PÚBLICO total a la tabla con la anon key. Todo el acceso real
--     es server-side vía service_role (bypassa RLS), así que el cliente no
--     necesita NINGÚN acceso directo → se remueve la policy.
-- Idempotente: se puede correr más de una vez sin error.
-- ================================================================

-- 1) Columna de propietario (bind al usuario autenticado de Supabase Auth)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS owner_id UUID;

-- Índice para listar/filtrar por propietario
CREATE INDEX IF NOT EXISTS idx_projects_owner
  ON public.projects (owner_id);

-- 2) Quitar el acceso público del MVP. RLS ya está habilitada (001);
--    sin policies de cliente = solo el service_role puede leer/escribir.
DROP POLICY IF EXISTS "allow_all_mvp" ON public.projects;

-- Endurecimiento extra: revocar cualquier grant de tabla al rol anónimo.
REVOKE ALL ON public.projects FROM anon;

-- Verificación
SELECT 'projects: owner_id agregado + acceso público removido ✓' AS status;
