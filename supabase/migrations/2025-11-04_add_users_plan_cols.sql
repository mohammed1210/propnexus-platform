-- Migration: Add plan and stripe_customer_id columns to users table
-- Date: 2025-11-04

-- Add stripe_customer_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- Add plan column if it doesn't exist (default: 'free')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'plan'
  ) THEN
    ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';
  END IF;
END $$;

-- Create index on stripe_customer_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' 
    AND indexname = 'idx_users_stripe_customer_id'
  ) THEN
    CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
  END IF;
END $$;

-- Create unique index on email if it doesn't exist (required for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' 
    AND indexname = 'idx_users_email_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_users_email_unique ON users(email);
  END IF;
END $$;
