
-- Create public.off_market_leads as the canonical off-market storage table.
-- Safe to run multiple times.

-- gen_random_uuid() lives in pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.off_market_leads (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	created_at timestamptz NOT NULL DEFAULT now(),

	-- Ownership / provenance
	user_id uuid NULL,

	-- Core fields
	title text,
	location text,
	price numeric,
	bedrooms integer,
	bathrooms integer,
	investment_type text,
	contact text,
	source text,
	notes text,

	-- Extended fields (used by Off-Market UI)
	address text,
	postcode text,
	estimated_value numeric,
	refurb_cost numeric,
	rent_potential numeric,
	discount_percent numeric,
	investment_score integer,
	agent_name text,
	agent_phone text,
	status text,

	-- Photos (support both naming conventions; UI prefers imageurl)
	imageurl text,
	image_url text
);

CREATE INDEX IF NOT EXISTS off_market_leads_created_at_idx
	ON public.off_market_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS off_market_leads_location_idx
	ON public.off_market_leads (location);

CREATE INDEX IF NOT EXISTS off_market_leads_investment_type_idx
	ON public.off_market_leads (investment_type);

