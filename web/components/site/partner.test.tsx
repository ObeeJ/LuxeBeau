import { render, screen } from "@testing-library/react";
import { PartnerFrame } from "./partner";

describe("PartnerFrame", () => {
  it("renders benefits points and a call to action child", () => {
    render(
      <PartnerFrame
        title="Sell on LuxeBeau"
        body="List your beauty products."
        points={[
          "Zero upfront listing fees.",
          "Automatic escrow settlements on delivery.",
          "Reach shoppers nationwide.",
        ]}
      >
        <button>Apply to Sell</button>
      </PartnerFrame>,
    );

    expect(screen.getByText("Sell on LuxeBeau")).toBeInTheDocument();
    expect(screen.getByText("Zero upfront listing fees.")).toBeInTheDocument();
    expect(screen.getByText("Automatic escrow settlements on delivery.")).toBeInTheDocument();
    expect(screen.getByText("Reach shoppers nationwide.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply to Sell" })).toBeInTheDocument();
  });
});
