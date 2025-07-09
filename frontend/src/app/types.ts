export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  description: string;
  image: string;
  yieldValue: number;
  roi: number;
  propertyType?: string; // ✅ Add this
  investmentType?: string; // ✅ Add this
  latitude?: number; // if using map
  longitude?: number;
}
