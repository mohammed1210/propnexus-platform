// Listings page types

export interface Property {
  id: string;
  title: string;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  investment_type?: string | null;
  description?: string | null;
}

export interface FilterParams {
  search: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  investmentTypes: string[];
  sort: 'created_at' | 'price' | 'bedrooms' | 'roi_percent' | 'yield_percent';
  sortDirection: 'asc' | 'desc';
  heatmap?: boolean;
}

export interface MapPoint {
  id: string;
  title: string;
  lat: number;
  lng: number;
  price?: number | null;
}
