-- Add new profile fields for contract data
ALTER TABLE public.oli_profiles
ADD COLUMN IF NOT EXISTS rg TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Brasileiro(a)',
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS profession TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.oli_profiles.rg IS 'Número do RG do usuário';
COMMENT ON COLUMN public.oli_profiles.nationality IS 'Nacionalidade do usuário';
COMMENT ON COLUMN public.oli_profiles.marital_status IS 'Estado civil: solteiro, casado, divorciado, viuvo, uniao_estavel';
COMMENT ON COLUMN public.oli_profiles.profession IS 'Profissão do usuário';