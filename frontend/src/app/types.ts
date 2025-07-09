export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  imageurl: string;  // ✅ matches backend
  yield_percent: number;
  roi_percent: number;
  propertyType?: string;
  investmentType?: string;
  latitude?: number;
  longitude?: number;
}
