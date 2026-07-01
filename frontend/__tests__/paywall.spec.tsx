import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import PricingPage from "@/app/pricing/page";

describe("PricingPage", () => {
  it("renders the Sprint 2 launch pricing tiers and founding-member copy", () => {
    render(<PricingPage />);

    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Investor Starter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Investor Pro" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sourcer Pro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start free/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start starter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start pro/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /coming soon/i })).toBeInTheDocument();
    expect(screen.getByText(/Founding member pricing available for early users/i)).toBeInTheDocument();
    expect(screen.getByText("£9")).toBeInTheDocument();
    expect(screen.getByText("£19")).toBeInTheDocument();
    expect(screen.getByText("£39")).toBeInTheDocument();
    expect(screen.getByText(/Unlimited saved deals \(fair usage\)/i)).toBeInTheDocument();
  });
});
