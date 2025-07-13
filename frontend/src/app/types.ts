export interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  imageurl: string;
  description: string;
  source: string;
  yield_percent: number;
  roi_percent: number;
  bedrooms: number;
  bathrooms?: number; // Optional if backend doesn't always send it
  propertyType?: string;
  investmentType?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}
