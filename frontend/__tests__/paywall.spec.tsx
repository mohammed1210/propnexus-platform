import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import PricingPage from "@/app/pricing/page";

describe("PricingPage", () => {
  it("renders the soft-launch Free and Investor tiers", () => {
    render(<PricingPage />);

    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Investor" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pro" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start free/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start 7-day free trial/i })).toBeInTheDocument();
    expect(screen.queryByText(/off-market|pdf deal packs|portfolio analytics|alerts|crm|zapier|webhook/i)).not.toBeInTheDocument();
  });
});
