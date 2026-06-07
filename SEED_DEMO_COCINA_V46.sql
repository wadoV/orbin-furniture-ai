-- ═══════════════════════════════════════════════════════════════
-- Orbin AI v4.6 — Supabase Seed: Proyecto Demo Cocina Industrial
-- Dashboard Supabase → SQL Editor → New query → Pega y ejecuta
-- ═══════════════════════════════════════════════════════════════

-- 1. Verificar que la tabla existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'projects') THEN
    RAISE EXCEPTION 'Tabla projects no existe. Ejecuta primero 001_create_projects.sql';
  END IF;
END $$;

-- 2. Insertar proyecto demo (UPSERT — seguro si ya existe)
INSERT INTO public.projects (id, label, modules, params, summary)
VALUES (
  'DEMO-COCINA-V46',
  'Cocina Base Demo — Marcenaria Orbin Pro',
  '[{"id":"MOD-COCINA-001","type":"base","configuration":{"moduleType":"base","width":600,"height":870,"depth":580,"thickness":18,"backThickness":6,"numShelves":1,"numDrawers":2,"drawerHeight":180,"hasDoors":false,"baseboard":true,"baseboardHeight":100,"hasCountertop":true,"materialBody":"oak_light","materialFront":"white"}},{"id":"MOD-COCINA-002","type":"base","configuration":{"moduleType":"base","width":900,"height":870,"depth":580,"thickness":18,"backThickness":6,"numShelves":0,"numDrawers":3,"drawerHeight":200,"hasDoors":false,"baseboard":true,"baseboardHeight":100,"hasCountertop":true,"materialBody":"oak_light","materialFront":"white"}},{"id":"MOD-COCINA-003","type":"wall","configuration":{"moduleType":"wall","width":600,"height":720,"depth":350,"thickness":18,"backThickness":6,"numShelves":2,"hasDoors":true,"numDoors":2,"materialBody":"oak_light","materialFront":"white"}}]'::jsonb,
  '{"owner_email":"demo@orbin-industrial.dev","plan":"enterprise","company":"Marcenaria Orbin Pro","version":"v4.6","seeded_at":"{}"}' ::jsonb,
  '{"totalModules":3,"moduleTypes":["base","base","wall"],"totalWidth":2100,"estimatedPieces":42}'::jsonb
)
ON CONFLICT (id) DO UPDATE
  SET label      = EXCLUDED.label,
      modules    = EXCLUDED.modules,
      updated_at = now();

-- 3. Verificar inserción
SELECT
  id,
  label,
  jsonb_array_length(modules) AS num_modulos,
  created_at
FROM public.projects
WHERE id = 'DEMO-COCINA-V46';

-- ✅ Resultado esperado: 1 fila, num_modulos = 3
