-- Sprint 11: Fix RLS policies for authenticated users to view properties
-- Issue: Logged-in users see no listings (signed-out users can browse)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "properties_read_auth" ON public.properties;
DROP POLICY IF EXISTS "properties_read_anon" ON public.properties;

-- Allow authenticated users to read published properties
CREATE POLICY "properties_read_auth"
ON public.properties FOR SELECT
TO authenticated
USING (published = true);

-- Allow anonymous users to read published properties (for public browse)
CREATE POLICY "properties_read_anon"
ON public.properties FOR SELECT
TO anon
USING (published = true);

-- Add comment
COMMENT ON POLICY "properties_read_auth" ON public.properties IS 'Sprint 11: Allow authenticated users to browse published properties';
COMMENT ON POLICY "properties_read_anon" ON public.properties IS 'Sprint 11: Allow anonymous users to browse published properties';
