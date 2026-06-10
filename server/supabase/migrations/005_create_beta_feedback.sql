-- ================================================================
-- Orbin AI — Tabla de feedback de beta
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  message     TEXT        NOT NULL,
  email       TEXT,
  page        TEXT,
  lang        TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at
  ON public.beta_feedback (created_at DESC);

-- Rellenar user_id automáticamente con el usuario autenticado (si lo hay)
CREATE OR REPLACE FUNCTION public.set_feedback_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_beta_feedback_user ON public.beta_feedback;
CREATE TRIGGER trg_beta_feedback_user
  BEFORE INSERT ON public.beta_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_feedback_user_id();

-- RLS: cualquiera puede ENVIAR feedback; nadie puede LEER vía API.
-- (La lectura se hace desde el dashboard con la service_role key, que ignora RLS.)
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beta_feedback_insert_anyone" ON public.beta_feedback;
CREATE POLICY "beta_feedback_insert_anyone"
  ON public.beta_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- (Intencionalmente SIN policy de SELECT/UPDATE/DELETE → bloqueadas para clientes.)
