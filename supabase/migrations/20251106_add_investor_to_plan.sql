-- Sprint 11: Add 'investor' to plan constraint
-- Update users table plan constraint to include investor tier

-- Drop the existing constraint if it exists
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_plan_check;

-- Add new constraint with investor included
ALTER TABLE public.users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'pro', 'investor', 'enterprise'));

-- Add columns if they don't exist for plan tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='plan_status') THEN
    ALTER TABLE public.users ADD COLUMN plan_status TEXT DEFAULT 'active';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='current_period_end') THEN
    ALTER TABLE public.users ADD COLUMN current_period_end BIGINT;
  END IF;
END $$;

-- Add comments
COMMENT ON CONSTRAINT users_plan_check ON public.users IS 'Sprint 11: Valid plan values including investor tier';
COMMENT ON COLUMN public.users.plan_status IS 'Subscription status: active, past_due, canceled';
COMMENT ON COLUMN public.users.current_period_end IS 'Unix timestamp of current billing period end';
