import { describe, it, expect, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";

jest.mock("@/components/SavedDeals/useSavedDeals", () => ({
  useSavedDeals: () => ({
    deals: [],
    loading: false,
    error: null,
    authRequired: true,
    selectedPropertyIds: [],
    toggleSelect: jest.fn(),
    clearSelection: jest.fn(),
    removeSaved: jest.fn(),
    maxHint: null,
  }),
}));

describe("SavedDealsView redirect", () => {
  it("links to sign-in with redirect_url=/saved", async () => {
    const SavedDealsView = (await import("@/components/SavedDeals/SavedDealsView")).default;
    render(<SavedDealsView />);

    const signIn = screen.getByRole("link", { name: /sign in/i });
    expect(signIn).toHaveAttribute("href", "/sign-in?redirect_url=/saved");
  });
});
