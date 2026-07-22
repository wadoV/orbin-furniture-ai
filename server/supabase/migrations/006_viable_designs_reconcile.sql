-- ================================================================
-- Orbin AI — Migration 006: reconciliación de viable_designs
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de 005)
--
-- CONTEXTO: verificación en vivo (2026-07-20) detectó que la tabla
-- `viable_designs` en producción DIVERGE de lo declarado en 005:
--   a) falta la columna `engine_version` → el endpoint /save-viable
--      fallaría con 500 ("column does not exist") en cada guardado.
--   b) `snapshot_json` quedó NOT NULL → rechaza filas legítimas y
--      además ENMASCARABA el fallo (c): los inserts de prueba se
--      bloqueaban por el NOT NULL, no por el guard de geometría.
--   c) el CHECK `viable_designs_geometry_sane` NO existe → la DB
--      aceptó geometría imposible (thickness=60 con width=100) y
--      ancho de 3000mm (> chapa de 2750mm). La defensa en
--      profundidad estaba ausente.
--
-- Esta migración es idempotente y auto-reparadora: se puede correr
-- las veces que haga falta, y también sirve si en el futuro la tabla
-- vuelve a divergir.
--
-- ESTADO: APLICADA en producción el 2026-07-20 y verificada contra la
-- DB real (8/8 columnas, CHECK bloquea geometría imposible / ancho
-- >2750mm / claves faltantes, snapshot_json nullable, anon sin acceso,
-- round-trip parametric_json → generateProject con piezas idénticas).
-- ================================================================

-- ── a) Columnas faltantes ────────────────────────────────────────
ALTER TABLE public.viable_designs
  ADD COLUMN IF NOT EXISTS snapshot_json  JSONB,
  ADD COLUMN IF NOT EXISTS engine_version TEXT,
  ADD COLUMN IF NOT EXISTS user_id        UUID;

-- ── b) snapshot_json debe ser NULLABLE ───────────────────────────
-- Es evidencia forense opcional, NO parte del contrato de datos.
-- `parametric_json` es el único campo cuya ausencia invalida la fila.
ALTER TABLE public.viable_designs
  ALTER COLUMN snapshot_json DROP NOT NULL;

-- ── c) CHECK de geometría (defensa en profundidad) ───────────────
-- El endpoint ya bloquea vía closetEngine + validator, pero un INSERT
-- manual (SQL Editor, script de carga, futuro job) no puede contaminar
-- la Biblioteca Verificada.
ALTER TABLE public.viable_designs
  DROP CONSTRAINT IF EXISTS viable_designs_geometry_sane;

-- NOTA: se usa jsonb_exists(col, key) en vez del operador `?`. Son
-- equivalentes, pero `?` rompe en clientes que lo interpretan como
-- placeholder de parámetro (y en el SQL Editor de Supabase dispara el
-- panel de atajos de teclado al tipearlo).
ALTER TABLE public.viable_designs
  ADD CONSTRAINT viable_designs_geometry_sane CHECK (
    jsonb_exists(parametric_json, 'width')     AND
    jsonb_exists(parametric_json, 'height')    AND
    jsonb_exists(parametric_json, 'depth')     AND
    jsonb_exists(parametric_json, 'thickness') AND
    (parametric_json->>'width')::numeric      > 0 AND
    (parametric_json->>'height')::numeric     > 0 AND
    (parametric_json->>'depth')::numeric      > 0 AND
    (parametric_json->>'thickness')::numeric  > 0 AND
    -- ninguna pieza horizontal puede exceder el largo de chapa (2750mm)
    (parametric_json->>'width')::numeric     <= 2750 AND
    -- espesor menor a la mitad del ancho → geometría posible
    (parametric_json->>'thickness')::numeric  < (parametric_json->>'width')::numeric / 2
  );

-- ── d) Índices (por si 005 se corrió parcial) ────────────────────
CREATE INDEX IF NOT EXISTS idx_viable_designs_user
  ON public.viable_designs (user_id);
CREATE INDEX IF NOT EXISTS idx_viable_designs_created_at
  ON public.viable_designs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viable_designs_module_type
  ON public.viable_designs (module_type);
CREATE INDEX IF NOT EXISTS idx_viable_designs_params_gin
  ON public.viable_designs USING GIN (parametric_json);

-- ── e) Lockdown de seguridad ─────────────────────────────────────
ALTER TABLE public.viable_designs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.viable_designs FROM anon;

-- ── Verificación ─────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name='viable_designs'
       AND column_name IN ('id','user_id','design_name','module_type','parametric_json','snapshot_json','engine_version','created_at')
  ) AS columnas_ok_de_8,
  (SELECT count(*) FROM pg_constraint WHERE conname='viable_designs_geometry_sane') AS check_geometria,
  (SELECT relrowsecurity FROM pg_class WHERE relname='viable_designs') AS rls_activa;
