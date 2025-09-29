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
  /** Steps are optional because the model may omit them sometimes */
  steps?: string[];
  /** Risk can be null/undefined depending on model output */
  risk?: string | null;
};

export type StrategiesResponse = {
  strategies: Strategy[];
};

export type StrategiesRequest = {
  property: {
    title: string;
    location: string;
    price?: number;
    yield_percent?: number;
    roi_percent?: number;
    propertyType?: string;
    investmentType?: string;
    description?: string;
    bedrooms?: number;
    bathrooms?: number;
  };
  /** Optional constraints; when omitted, backend uses defaults */
  constraints?: Record<string, string | number | boolean>;
};
