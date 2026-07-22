-- ================================================================
-- Orbin AI — Migration 007: columna `category` en viable_designs
-- Ejecutar en: Supabase Dashboard → SQL Editor (después de 005–006)
--
-- Propósito (Galería / Verified Templates Catalog · Fase 1):
-- etiqueta de negocio para filtrar la biblioteca por tipo de mueble
-- en la UI (Cocina, Aéreos, Baño, Closet/Ropero, Escritorio).
--
-- DECISIÓN DE DISEÑO: `category` NO se deriva de `module_type`. Un
-- módulo `standard` puede ser closet O baño; `base` puede ser cocina
-- O escritorio. La categoría se captura explícitamente al guardar
-- (el endpoint la valida contra una allow-list). NULL = sin clasificar.
--
-- Idempotente y additiva. No toca datos existentes.
-- ================================================================

ALTER TABLE public.viable_designs
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_viable_designs_category
  ON public.viable_designs (category);

-- Verificación — debe devolver la fila category | text
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'viable_designs'
  AND column_name  = 'category';
