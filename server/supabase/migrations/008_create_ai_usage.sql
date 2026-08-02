-- ================================================================
-- Orbin AI — Cuota diaria de IA por usuario  (ADITIVO 2026-08-02)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================
--
-- POR QUÉ ESTA TABLA Y NO UN CONTADOR EN MEMORIA
--   Un Map en el proceso se borra en cada deploy y no se comparte entre
--   réplicas. Con Railway reiniciando o escalando, la cuota sería decorativa:
--   el usuario espera un redeploy —o cae en otra instancia— y sigue gastando.
--   El contador tiene que sobrevivir al proceso o no es un contador.
--
-- POR QUÉ UN RPC Y NO read-then-write DESDE NODE
--   Dos peticiones concurrentes que leen 4 y escriben 5 dejan pasar 6 llamadas.
--   El INSERT ... ON CONFLICT DO UPDATE ... RETURNING es atómico en Postgres:
--   el conteo se resuelve en una sola sentencia, sin ventana de carrera.
--
-- HUSO HORARIO: el día es UTC. Un usuario en UTC-3 ve su cuota reiniciarse a
--   las 21:00 hora local. Es predecible y no requiere guardar el huso del
--   usuario; si algún día molesta, se cambia acá y no en el código.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id      UUID        NOT NULL,
  day          DATE        NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 0,
  last_feature TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

-- Barrido de filas viejas (retención/limpieza).
CREATE INDEX IF NOT EXISTS idx_ai_usage_day ON public.ai_usage (day);

-- ─── RLS: nadie toca esto desde el cliente ──────────────────────────────────
-- Sin políticas, `anon` y `authenticated` quedan sin acceso. El servidor
-- escribe con service_role, que ignora RLS por diseño. Si el usuario pudiera
-- escribir su propio contador, la cuota no valdría nada.
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- ─── Incremento atómico ─────────────────────────────────────────────────────
-- Devuelve el conteo YA INCLUIDA esta llamada. El middleware compara ese
-- número contra el límite del plan.
CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id UUID,
  p_day     DATE,
  p_feature TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_usage (user_id, day, count, last_feature)
  VALUES (p_user_id, p_day, 1, p_feature)
  ON CONFLICT (user_id, day) DO UPDATE
    SET count        = public.ai_usage.count + 1,
        last_feature = COALESCE(EXCLUDED.last_feature, public.ai_usage.last_feature),
        updated_at   = now()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- Sólo el backend (service_role) puede invocarla.
REVOKE ALL ON FUNCTION public.increment_ai_usage(UUID, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_ai_usage(UUID, DATE, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(UUID, DATE, TEXT) TO service_role;

-- ─── Lectura del consumo del día (para pintar "3 de 5" en la UI) ────────────
CREATE OR REPLACE FUNCTION public.get_ai_usage(p_user_id UUID, p_day DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT count FROM public.ai_usage WHERE user_id = p_user_id AND day = p_day), 0);
$$;

REVOKE ALL ON FUNCTION public.get_ai_usage(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ai_usage(UUID, DATE) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_usage(UUID, DATE) TO service_role;
