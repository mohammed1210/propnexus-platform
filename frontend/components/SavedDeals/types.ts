export type SavedDeal = {
  id: string;
  property_id: string | null;
  title?: string | null;
  location?: string | null;
  postcode?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  rent_monthly?: number | null;
  roi_is_proxy?: boolean | null;
  score?: number | null;
  ai_score?: number | null;
  score_breakdown?: ScoreBreakdownLike | null;
  imageurl?: string | null;
  saved_at?: string | null;
  created_at?: string | null;
  investment_type?: string | null;
  property_type?: string | null;
};

export type ScoreBreakdownLike = {
  version?: string | null;
  inputs?: {
    rent_source?: string | null;
    postcode_band?: string | null;
    rent_monthly?: number | null;
    cap_rate_proxy_percent?: number | null;
  } | null;
  categories?: Record<string, number> | null;
};

export type ComparableDeal = {
  id: string;
  source?: 'saved' | 'supabase' | 'backend';
  title?: string | null;
  location?: string | null;
  postcode?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  rent_monthly?: number | null;
  roi_is_proxy?: boolean | null;
  score?: number | null;
  ai_score?: number | null;
  imageurl?: string | null;
  investment_type?: string | null;
  score_breakdown?: ScoreBreakdownLike | null;
};
