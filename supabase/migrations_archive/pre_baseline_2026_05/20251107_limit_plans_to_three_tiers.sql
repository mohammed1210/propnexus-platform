-- Sprint 11.2: Limit plans to free, pro, investor (remove enterprise)
-- Update users table plan constraint to only allow three tiers

-- Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_plan_check;

-- Add new constraint with only free, pro, investor
ALTER TABLE public.users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'pro', 'investor'));

-- Add comment
COMMENT ON CONSTRAINT users_plan_check ON public.users IS 'Sprint 11.2: Valid plan values limited to free, pro, investor';
