export type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
  description: string;
  latitude: number;
  longitude: number;
  address?: string; // ✅ optional if you might not always have it
};
