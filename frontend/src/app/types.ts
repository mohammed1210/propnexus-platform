export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms?: number;
  bathrooms?: number;
  description: string;
  imageurl: string;
  yield_percent: number;
  roi_percent: number;
  source: string;          // ✅ add this
  bmv?: number;
  created_at?: string;
  propertyType?: string;
  investmentType?: string;
  latitude?: number;
  longitude?: number;
}
