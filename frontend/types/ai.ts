// /frontend/types/ai.ts
export interface SummaryRequest {
  title: string;
  location: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  yield_percent?: number;
  roi_percent?: number;
  propertyType?: string;
  investmentType?: string;
  description?: string;
}

export interface SummaryResponse {
  summary: string;
  bullets?: string[];
}

export interface StrategiesRequest {
  title: string;
  location: string;
  price?: number;
  yield_percent?: number;
  roi_percent?: number;
  propertyType?: string;
  investmentType?: string;
  description?: string;
}

export interface StrategiesResponse {
  strategies: string[];
}
