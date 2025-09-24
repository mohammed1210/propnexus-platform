// frontend/types/ai.ts
export type SummaryRequest = {
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
};

export type SummaryResponse = {
  summary?: string;
  bullets?: string[];
};

export type Strategy = {
  title: string;
  rationale: string;
  steps: string[];
  risk?: string;
};

export type StrategiesResponse = {
  strategies: Strategy[];
};

export type StrategiesRequest = {
  property: Omit<SummaryRequest, 'bedrooms' | 'bathrooms'> & {
    // bedrooms/bathrooms optional here too if you’ll use them for strategies
    bedrooms?: number;
    bathrooms?: number;
  };
  constraints?: Record<string, unknown>;
};
