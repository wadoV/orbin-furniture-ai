-- ================================================================
-- Orbin AI — Profiles Schema & Google Auth Integration Trigger
-- ================================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id                       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  focus_metric             TEXT        NOT NULL DEFAULT 'uso_del_tiempo',
  confrontation_level      TEXT        NOT NULL DEFAULT 'hybrid',
  tdah_assistance_enabled  BOOLEAN     NOT NULL DEFAULT true
);

-- Trigger: update updated_at automatically
CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_updated_at();

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, focus_metric, confrontation_level, tdah_assistance_enabled)
  VALUES (
    NEW.id,
    'uso_del_tiempo',
    'hybrid',
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Select policy: User can only select their own profile
CREATE POLICY "Allow users to read their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Update policy: User can only update their own profile fields
CREATE POLICY "Allow users to update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

SELECT 'Tabla profiles y trigger creados correctamente ✓' AS status;
