import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import PricingPage from "@/app/pricing/page";

describe("PricingPage", () => {
  it("renders paywall CTA buttons", () => {
    render(<PricingPage />);

    // Buttons are accessible by their visible name (no aria-label now)
    const ctas = screen.getAllByRole("button", {
      name: /start 7-day free trial/i,
    });

    expect(ctas.length).toBeGreaterThan(0);

    // Optional: if you expect exactly 2 CTAs (Pro + Investor), enforce it:
    // expect(ctas).toHaveLength(2);
  });
});
