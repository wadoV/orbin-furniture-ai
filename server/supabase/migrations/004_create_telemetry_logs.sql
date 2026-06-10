-- ================================================================
-- Orbin AI — Telemetry Logs Schema & Google Auth / n8n Telemetry
-- ================================================================

CREATE TABLE IF NOT EXISTS public.telemetry_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source       TEXT        NOT NULL,
  metric_name  TEXT        NOT NULL,
  metric_value JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick sorting and querying by user and time
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_user_created
  ON public.telemetry_logs (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.telemetry_logs ENABLE ROW LEVEL SECURITY;

-- Select Policy
CREATE POLICY "Allow users to read their own telemetry logs"
  ON public.telemetry_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Insert Policy
CREATE POLICY "Allow users to insert their own telemetry logs"
  ON public.telemetry_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

SELECT 'Tabla telemetry_logs creada correctamente ✓' AS status;
