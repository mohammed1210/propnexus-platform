// frontend/types/ai.ts
export type SummaryRequest = {
  title: string;             // required
  location: string;          // required
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
  rationale?: string | null;
  steps?: string[] | null;
  risk?: string | null;
};

export type StrategiesRequest = {
  property: Omit<SummaryRequest, "title" | "location"> & {
    title: string;
    location: string;
  };
  constraints?: {
    budget?: number;
    tolerance?: "low" | "medium" | "high";
  };
};

export type StrategiesResponse = {
  strategies: Strategy[];
};
