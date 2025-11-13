export interface OffMarketDeal {
  id: string;
  // core
  title: string;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  notes?: string | null;
  source?: string | null;
  created_at?: string | null;
  image_url?: string | null;

  // spark-extended (optional in DB)
  address?: string | null;
  postcode?: string | null;
  estimated_value?: number | null;
  refurb_cost?: number | null;
  rent_potential?: number | null;
  discount_percent?: number | null;
  investment_score?: number | null;
  agent_name?: string | null;
  agent_phone?: string | null;
  status?: string | null;
  imageurl?: string | null; // keep spark naming for compatibility
}

export interface DealFilters {
  postcode?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  minScore?: number;
}

export type ViewMode = 'cards' | 'table';
