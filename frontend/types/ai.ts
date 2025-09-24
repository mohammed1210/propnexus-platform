export interface SummaryRequest {
  title: string;
  price?: number;
  location: string;
  yield?: number;
  roi?: number;
  description?: string;
}

export interface SummaryResponse {
  summary: string;
  bullets: string[];
}

export interface StrategiesRequest {
  property: Record<string, any>;
  constraints?: Record<string, any>;
}

export interface Strategy {
  title: string;
  rationale: string;
  steps: string[];
  risk?: string;
}

export interface StrategiesResponse {
  strategies: Strategy[];
}
