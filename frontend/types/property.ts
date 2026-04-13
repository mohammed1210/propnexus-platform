export interface Property {
  id: string;
  title: string | null;
  price: number | null;
  location: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  score?: number | null;
  imageurl?: string | null;
  created_at?: string | null;
}
