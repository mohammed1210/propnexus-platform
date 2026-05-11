// src/types.ts
export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  imageurl: string;
  yield_percent: number;
  roi_percent: number;
  top_deal_score?: number | null;
  top_deal_tier?: string | null;
  top_deal_reasons?: string[] | null;
  top_deal?: {
    score?: number | null;
    tier?: string | null;
    reasons?: string[] | null;
    evidence?: Record<string, unknown> | null;
  } | null;
  source: string;
  source_url?: string | null;
  listing_url?: string | null;
  property_url?: string | null;
  external_url?: string | null;
  original_url?: string | null;
  original_listing_url?: string | null;
  rightmove_url?: string | null;
  zoopla_url?: string | null;
  onthemarket_url?: string | null;
  agent_name?: string | null;
  agency_name?: string | null;
  branch_name?: string | null;
  agent_phone?: string | null;
  contact_phone?: string | null;
  agent_email?: string | null;
  contact_email?: string | null;
  deal_status?: string | null;
  contacted_at?: string | null;
  last_action_at?: string | null;
  action_notes?: string | null;
  created_at: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  investmentType: string;
}
