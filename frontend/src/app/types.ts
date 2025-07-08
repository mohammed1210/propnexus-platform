export type Property = {
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
  latitude?: number;
  longitude?: number;
};