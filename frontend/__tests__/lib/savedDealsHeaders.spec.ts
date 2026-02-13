/** @jest-environment node */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

import { fetchSavedDeals } from "@/lib/api/savedDeals";

describe("savedDeals API utility", () => {
  const oldFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = oldFetch;
  });

  it("sets X-Clerk-User-Id header when userId is provided", async () => {
    const userId = "user_123";

    (global.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
      text: async () => "",
    });

    await fetchSavedDeals({ userId });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/saved-deals",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-clerk-user-id": userId,
        }),
      }),
    );
  });
});
