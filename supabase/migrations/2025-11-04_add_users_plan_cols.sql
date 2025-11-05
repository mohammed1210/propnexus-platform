ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free' CHECK (plan IN ('free','pro','investor')),
ADD COLUMN IF NOT EXISTS subscription_status text;
