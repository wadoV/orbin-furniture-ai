-- ================================================================
-- Orbin AI — Schema inicial
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- Tabla principal de proyectos
CREATE TABLE IF NOT EXISTS public.projects (
  id           TEXT        PRIMARY KEY,
  label        TEXT        NOT NULL DEFAULT 'Proyecto sin título',
  modules      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  params       JSONB,
  cut_list     JSONB,
  summary      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice por fecha de creación (para listar recientes)
CREATE INDEX IF NOT EXISTS idx_projects_created_at
  ON public.projects (created_at DESC);

-- Trigger: actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: habilitar Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policy temporal: acceso público (para MVP sin auth)
-- REEMPLAZAR en producción con políticas de usuario
CREATE POLICY "allow_all_mvp" ON public.projects
  FOR ALL USING (true) WITH CHECK (true);

-- Verificación
SELECT 'Tabla projects creada correctamente ✓' AS status;
