-- supabase/migrations/2025-11-04_add_users_plan_cols.sql
-- Add plan and stripe_customer_id columns to users table if they don't exist

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add plan column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='plan') THEN
    ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';
  END IF;
END $$;

-- Add stripe_customer_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='stripe_customer_id') THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- Create index on email for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on stripe_customer_id for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Add comment to document the columns
COMMENT ON COLUMN users.plan IS 'Subscription plan: free, pro, investor';
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for billing';
