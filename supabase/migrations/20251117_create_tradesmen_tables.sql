-- Migration: Create tradesmen tables and related structures
-- Created: 2025-11-17
-- Description: Tables for tradesmen directory, reviews, and lead tracking

-- ======================
-- 1. Tradesmen Table
-- ======================
CREATE TABLE IF NOT EXISTS tradesmen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  rating NUMERIC DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  latitude NUMERIC,
  longitude NUMERIC,
  service_radius_km INTEGER DEFAULT 20 CHECK (service_radius_km > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tradesmen_location ON tradesmen(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_tradesmen_trade_type ON tradesmen(trade_type);
CREATE INDEX IF NOT EXISTS idx_tradesmen_rating ON tradesmen(rating DESC);

-- Enable RLS
ALTER TABLE tradesmen ENABLE ROW LEVEL SECURITY;

-- Allow public read access to tradesmen (they are a directory)
CREATE POLICY tradesmen_public_read ON tradesmen
  FOR SELECT
  USING (true);

-- Allow service role full access for admin operations
CREATE POLICY tradesmen_service_policy ON tradesmen
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON TABLE tradesmen IS 'Directory of tradespeople (builders, plumbers, electricians, etc.) available for property work';
COMMENT ON COLUMN tradesmen.trade_type IS 'Type of trade: builder, plumber, electrician, roofer, surveyor, etc.';
COMMENT ON COLUMN tradesmen.service_radius_km IS 'Radius in kilometers that tradesman services';
COMMENT ON COLUMN tradesmen.rating IS 'Average rating from 0 to 5 stars';

-- ======================
-- 2. Tradesmen Reviews Table
-- ======================
CREATE TABLE IF NOT EXISTS tradesmen_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tradesman_id UUID NOT NULL REFERENCES tradesmen(id) ON DELETE CASCADE,
  user_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reviews_tradesman ON tradesmen_reviews(tradesman_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON tradesmen_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON tradesmen_reviews(created_at DESC);

-- Enable RLS
ALTER TABLE tradesmen_reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to reviews
CREATE POLICY reviews_public_read ON tradesmen_reviews
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert their own reviews
CREATE POLICY reviews_user_insert ON tradesmen_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY reviews_service_policy ON tradesmen_reviews
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON TABLE tradesmen_reviews IS 'User reviews and ratings for tradespeople';
COMMENT ON COLUMN tradesmen_reviews.rating IS 'Rating from 1 to 5 stars';

-- ======================
-- 3. Tradesmen Leads Table
-- ======================
CREATE TABLE IF NOT EXISTS tradesmen_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tradesman_id UUID NOT NULL REFERENCES tradesmen(id) ON DELETE CASCADE,
  property_id UUID,
  user_email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'read', 'replied', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_tradesman ON tradesmen_leads(tradesman_id);
CREATE INDEX IF NOT EXISTS idx_leads_property ON tradesmen_leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_email ON tradesmen_leads(user_email);
CREATE INDEX IF NOT EXISTS idx_leads_created ON tradesmen_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON tradesmen_leads(status);

-- Enable RLS
ALTER TABLE tradesmen_leads ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own leads
CREATE POLICY leads_user_select ON tradesmen_leads
  FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- Allow authenticated users to insert leads
CREATE POLICY leads_user_insert ON tradesmen_leads
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow service role full access
CREATE POLICY leads_service_policy ON tradesmen_leads
  FOR ALL
  TO service_role
  USING (true);

COMMENT ON TABLE tradesmen_leads IS 'Tracks contact attempts from investors to tradespeople';
COMMENT ON COLUMN tradesmen_leads.status IS 'Lead status: sent, read, replied, archived';
COMMENT ON COLUMN tradesmen_leads.property_id IS 'Optional reference to the property being discussed';

-- ======================
-- 4. Function to update tradesman rating
-- ======================
CREATE OR REPLACE FUNCTION update_tradesman_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tradesmen
  SET rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM tradesmen_reviews
    WHERE tradesman_id = COALESCE(NEW.tradesman_id, OLD.tradesman_id)
  )
  WHERE id = COALESCE(NEW.tradesman_id, OLD.tradesman_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update rating when reviews change
DROP TRIGGER IF EXISTS trigger_update_tradesman_rating ON tradesmen_reviews;
CREATE TRIGGER trigger_update_tradesman_rating
  AFTER INSERT OR UPDATE OR DELETE ON tradesmen_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_tradesman_rating();

COMMENT ON FUNCTION update_tradesman_rating() IS 'Automatically updates tradesman average rating when reviews are added/updated/deleted';
