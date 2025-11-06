-- Sprint 11: Fix RLS policies for saved_deals table
-- Issue: Saved deals not showing even though DB has rows

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "saved_deals_rw_owner" ON public.saved_deals;
DROP POLICY IF EXISTS "saved_deals_insert_owner" ON public.saved_deals;
DROP POLICY IF EXISTS "saved_deals_delete_owner" ON public.saved_deals;

-- Allow users to read their own saved deals
CREATE POLICY "saved_deals_rw_owner"
ON public.saved_deals FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert their own saved deals
CREATE POLICY "saved_deals_insert_owner"
ON public.saved_deals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own saved deals
CREATE POLICY "saved_deals_delete_owner"
ON public.saved_deals FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add comments
COMMENT ON POLICY "saved_deals_rw_owner" ON public.saved_deals IS 'Sprint 11: Allow users to read their own saved deals';
COMMENT ON POLICY "saved_deals_insert_owner" ON public.saved_deals IS 'Sprint 11: Allow users to insert their own saved deals';
COMMENT ON POLICY "saved_deals_delete_owner" ON public.saved_deals IS 'Sprint 11: Allow users to delete their own saved deals';
