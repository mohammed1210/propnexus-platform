export type RentEvidence = {
  source?: string | null;
  quality?: string | null;
  is_real_rent_evidence?: boolean | null;
  monthly_rent?: number | null;
  usable_rent_comps?: number | null;
};

export type RentComp = {
  rent_monthly?: number | null;
  title?: string | null;
  short_address?: string | null;
  postcode?: string | null;
  location?: string | null;
  bedrooms?: number | string | null;
  property_type?: string | null;
  source?: string | null;
  date?: string | null;
  source_url?: string | null;
};

export type InvestorIntel = {
  property_id?: string | null;
  asking_price?: number | null;
  current_monthly_rent?: number | null;
  gross_yield_percent?: number | null;
  rent_evidence?: RentEvidence | null;
  rent_comps?: RentComp[] | null;
  rent_comp_count?: number | null;
  rent_comp_range_low?: number | null;
  rent_comp_range_high?: number | null;
  rent_comp_median?: number | null;
  rent_comp_confidence?: string | null;
  sold_comp_benchmark?: {
    median_similar_price?: number | null;
    benchmark_confidence?: string | null;
    subject_vs_median_amount?: number | null;
    subject_vs_median_pct?: number | null;
    similar_sales_count?: number | null;
    range_low?: number | null;
    range_high?: number | null;
  } | null;
  offer_intelligence?: {
    rent_required_at_asking?: Record<string, number | null>;
    target_purchase_price_from_rent?: Record<string, number | null>;
    price_gap_to_7pct_yield?: number | null;
  } | null;
  listing_history?: Record<string, unknown> | null;
  conclusion?: string | null;
};
