-- ================================================================
-- Orbin AI — Migration 005: viable_designs ("Biblioteca Verificada")
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de 001–004)
--
-- Propósito: almacenar ÚNICAMENTE diseños paramétricos que el
-- validador estructural (server/src/engine/validator.js) marcó como
-- VALIDADO — 0 errores críticos, 0 colisiones estructurales.
-- Esta tabla es la fuente de verdad de "lógica de mueble fabricable"
-- y alimentará futuros presets / RAG / fine-tuning.
--
-- CONTRATO DE DATOS (crítico):
--   parametric_json = el objeto `configuration` que consume
--   closetEngine.generateProject(params). Es un payload REPLAYABLE:
--   generateProject(parametric_json) debe reconstruir el diseño byte
--   a byte. NO guardar aquí piezas/cutlist derivadas: eso caduca
--   cuando cambia la versión del motor.
--
--   snapshot_json  = salida completa del motor + validación en el
--   momento del guardado. Sirve como evidencia forense / detección de
--   deriva ("regression drift") cuando el motor evolucione.
--
-- Idempotente: se puede correr más de una vez sin error.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.viable_designs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,                                   -- nullable por ahora (ver 004: bind opcional)
  design_name     TEXT        NOT NULL,
  module_type     TEXT        NOT NULL DEFAULT 'standard',
  parametric_json JSONB       NOT NULL,                   -- payload de entrada de closetEngine.generateProject()
  snapshot_json   JSONB,                                  -- salida completa del motor + validation (evidencia)
  engine_version  TEXT,                                   -- versión del motor que produjo el VALIDADO
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_viable_designs_user
  ON public.viable_designs (user_id);

CREATE INDEX IF NOT EXISTS idx_viable_designs_created_at
  ON public.viable_designs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_viable_designs_module_type
  ON public.viable_designs (module_type);

-- Búsqueda por parámetros dentro del JSON (p. ej. WHERE parametric_json @> '{"moduleType":"base"}')
CREATE INDEX IF NOT EXISTS idx_viable_designs_params_gin
  ON public.viable_designs USING GIN (parametric_json);

-- ── Guard de integridad a nivel DB ───────────────────────────────
-- Defensa en profundidad: aunque el endpoint ya bloquea, la DB
-- rechaza filas sin geometría mínima. Un INSERT manual descuidado
-- (SQL Editor, script de migración de datos) no puede contaminar la
-- biblioteca verificada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'viable_designs_geometry_sane'
  ) THEN
    ALTER TABLE public.viable_designs
      ADD CONSTRAINT viable_designs_geometry_sane CHECK (
        (parametric_json->>'width')::numeric      > 0 AND
        (parametric_json->>'height')::numeric     > 0 AND
        (parametric_json->>'depth')::numeric      > 0 AND
        (parametric_json->>'thickness')::numeric  > 0 AND
        -- ninguna pieza puede exceder la chapa: el ancho externo no puede
        -- superar el largo aprovechable de chapa (2750mm)
        (parametric_json->>'width')::numeric     <= 2750 AND
        -- el espesor debe ser menor a la mitad del ancho (geometría posible)
        (parametric_json->>'thickness')::numeric  < (parametric_json->>'width')::numeric / 2
      );
  END IF;
END $$;

-- ── Seguridad: RLS + sin acceso público ──────────────────────────
-- Todo el acceso real es server-side vía service_role (bypassa RLS).
-- Sin policies de cliente = el anon key no puede leer ni escribir.
ALTER TABLE public.viable_designs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.viable_designs FROM anon;

-- Verificación
SELECT 'viable_designs creada + RLS lockdown + check de geometría ✓' AS status;
