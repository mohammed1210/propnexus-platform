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
  propertyType?: string; // ✅ Add this
  investmentType?: string; // ✅ Add this
  latitude?: number; // if using map
  longitude?: number;
}
