-- ================================================================
-- Orbin AI — Migration 002: Create material_prices table
-- ================================================================

CREATE TABLE IF NOT EXISTS public.material_prices (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code VARCHAR(100)  UNIQUE NOT NULL,
  display_name  VARCHAR(255)  NOT NULL,
  price_per_m2  NUMERIC(10,2) NOT NULL,
  unit          VARCHAR(50)   NOT NULL DEFAULT 'm2',
  region        VARCHAR(10)   NOT NULL DEFAULT 'BR',
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  source_url    TEXT
);

-- Index for lookup optimization
CREATE INDEX IF NOT EXISTS idx_material_prices_lookup
  ON public.material_prices (material_code, region);

-- Enable RLS
ALTER TABLE public.material_prices ENABLE ROW LEVEL SECURITY;

-- Allow public read access (select)
CREATE POLICY "Allow public read access" ON public.material_prices
  FOR SELECT USING (true);

-- Allow all operations for the service role
GRANT ALL ON public.material_prices TO service_role;
GRANT SELECT ON public.material_prices TO anon;
