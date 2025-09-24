import { render, screen, waitFor } from "@testing-library/react";
import InvestmentSummary from "../components/property_details/InvestmentSummary";
import * as api from "../lib/api";

describe("InvestmentSummary", () => {
  it("renders text summary without charts", async () => {
    jest
      .spyOn(api, "postAiSummary")
      .mockResolvedValue({ summary: "Test summary", bullets: ["One", "Two"] });
    render(<InvestmentSummary title="Title" location="UB8" />);
    await waitFor(() => screen.getByTestId("investment-summary-text"));
    expect(screen.getByText("Test summary")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
