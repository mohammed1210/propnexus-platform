/** @jest-environment node */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// Mock Clerk server auth used by the route handler
jest.mock("@clerk/nextjs/server", () => ({
  auth: () => ({ userId: null }),
}));

describe("/api/saved-deals unauth", () => {
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = { ...oldEnv };

    // Force the route's isClerkServerEnabled() to evaluate to true
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xxx";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";
    delete process.env.NEXT_PUBLIC_DISABLE_AUTH;
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it("returns 401 JSON when user is not signed in", async () => {
    const { GET } = await import("@/app/api/saved-deals/route");

    const res = await GET(new Request("http://localhost/api/saved-deals"));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json).toEqual({ error: "Not authenticated" });
  });
});
