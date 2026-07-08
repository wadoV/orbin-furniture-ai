-- ================================================================
-- Orbin AI — Migration 003: promo_redemptions (single-use enforcement)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Contexto: PROMO_CODES (server/src/routes/billing.js) no tenían
-- tracking de uso — cualquier código (ej. KIRA2080 o uno de los
-- ORBIN-XXXX-YYYY de beta tester) podía ser redimido por infinitas
-- cuentas distintas sin límite, y no había forma de revocar uno
-- filtrado sin tocar código + redeploy. Esta tabla registra cada
-- redención para poder aplicar un máximo de usos por código.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT        NOT NULL,
  user_id      UUID        NOT NULL,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un mismo usuario no puede "redimir" el mismo código dos veces
  -- (evita inflar el contador de usos accidentalmente con reintentos).
  UNIQUE (code, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code
  ON public.promo_redemptions (code);

-- RLS: habilitada SIN policies de cliente. Solo el service_role
-- (que bypassea RLS) puede leer/escribir — el cliente público nunca
-- debe poder ver ni insertar redenciones directamente.
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Verificación
SELECT 'Tabla promo_redemptions creada correctamente ✓' AS status;
