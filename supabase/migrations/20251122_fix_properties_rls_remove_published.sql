-- Fix RLS policies for properties table
-- Issue: RLS policies reference 'published' column which doesn't exist in the schema
-- This causes all queries to return 0 results for both authenticated and anonymous users
-- Solution: Remove the 'published' requirement and allow all users to read all properties
-- Note: All properties are considered public/published by default
-- Future: If you need draft/published workflow, add a 'published' boolean column
--         and update these policies to check that column

-- Drop existing policies that reference the non-existent 'published' column
DROP POLICY IF EXISTS "properties_read_auth" ON public.properties;
DROP POLICY IF EXISTS "properties_read_anon" ON public.properties;

-- Allow authenticated users to read all properties
-- Rationale: Properties are public listings meant to be browsed by all users
CREATE POLICY "properties_read_auth"
ON public.properties FOR SELECT
TO authenticated
USING (true);

-- Allow anonymous users to read all properties (for public browse)
-- Rationale: Public property listings should be accessible without authentication
CREATE POLICY "properties_read_anon"
ON public.properties FOR SELECT
TO anon
USING (true);

-- Add comments
COMMENT ON POLICY "properties_read_auth" ON public.properties IS 'Allow authenticated users to browse all properties';
COMMENT ON POLICY "properties_read_anon" ON public.properties IS 'Allow anonymous users to browse all properties';
