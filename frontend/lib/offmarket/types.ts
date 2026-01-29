export interface OffMarketDeal {
  id: string;
  // core
  title: string;
  location?: string | null;
  asking_price?: number | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  notes?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  image_url?: string | null;
  score?: number | null;
  investment_type?: string | null;
  property_type?: string | null;
  contact_email?: string | null;
  lat?: number | null;
  lng?: number | null;

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
  minBedrooms?: number;
  minBathrooms?: number;
}

export type ViewMode = 'cards' | 'table';
