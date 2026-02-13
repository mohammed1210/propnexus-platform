import { describe, it, expect, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";

describe("SavedDealsView redirect", () => {
  it("links to sign-in with redirect_url=/saved", async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
      text: async () => "",
    });

    const SavedDealsView = (await import("@/components/SavedDeals/SavedDealsView")).default;
    render(<SavedDealsView />);

    const signIn = await screen.findByRole("link", { name: /sign in/i });
    expect(signIn).toHaveAttribute("href", "/sign-in?redirect_url=/saved");
  });
});
