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
  source: string;
  created_at?: string;
  bmv?: number;
  propertyType?: string;
  investmentType?: string;
  latitude?: number;
  longitude?: number;
}
