-- ============================================================
-- Orbin AI — Supabase Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Tabla principal de proyectos
CREATE TABLE IF NOT EXISTS public.projects (
  id           TEXT        PRIMARY KEY,
  label        TEXT        NOT NULL DEFAULT 'Proyecto sin nombre',
  modules      JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para ordenamiento por fecha (listado de proyectos recientes)
CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON public.projects (created_at DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que llama la función en cada UPDATE
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) — desactivado para MVP sin auth
-- Cuando agregues autenticación, activa RLS y añade políticas de usuario
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

-- Grants para el service role (acceso total del servidor)
GRANT ALL ON public.projects TO service_role;

-- Grant para anon (solo lectura — si quieres permitir acceso público)
GRANT SELECT ON public.projects TO anon;

-- ============================================================
-- Verificar que la tabla fue creada correctamente
-- ============================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
