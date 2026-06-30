ALTER TABLE properties
ADD COLUMN IF NOT EXISTS raw_property_type text,
ADD COLUMN IF NOT EXISTS normalised_property_type text,
ADD COLUMN IF NOT EXISTS property_type_confidence numeric,
ADD COLUMN IF NOT EXISTS property_type_source text,
ADD COLUMN IF NOT EXISTS property_type_mismatch boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS matched_type_terms jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS deal_keywords jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS investment_signals jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_properties_normalised_property_type
ON properties(normalised_property_type);
