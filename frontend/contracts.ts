export interface SearchClickPayload {
  queryId: string;
  listingId: string;
  rank?: number;
  queryText?: string;
  filters?: Record<string, unknown>;
  userId?: string;
  clerkUserId?: string;
}
