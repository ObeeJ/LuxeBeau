import { render, screen } from "@testing-library/react";
import { Figures, Panel, RecordRow, StatusPill } from "./widgets";

describe("Dashboard Widgets", () => {
  it("Figures component renders labels and values", () => {
    const items = [
      { label: "Active Orders", value: "14" },
      { label: "Total Revenue", value: "₦450,000" },
    ];
    render(<Figures items={items} />);

    expect(screen.getByText("Active Orders")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("₦450,000")).toBeInTheDocument();
  });

  it("RecordRow stacks elements on small mobile screens", () => {
    const { container } = render(
      <RecordRow
        title="Order #1002"
        subtitle="2 items from Maison Eko"
        amount="₦25,000"
        status={<StatusPill status="paid" />}
      />,
    );

    const li = container.querySelector("li");
    expect(li).toBeInTheDocument();
    expect(li?.className).toContain("flex-col sm:flex-row");
    expect(screen.getByText("Order #1002")).toBeInTheDocument();
    expect(screen.getByText("₦25,000")).toBeInTheDocument();
  });

  it("Panel renders title and children inside rounded soft card", () => {
    render(
      <Panel title="Recent Transactions">
        <p>No transactions yet.</p>
      </Panel>,
    );

    expect(screen.getByText("Recent Transactions")).toBeInTheDocument();
    expect(screen.getByText("No transactions yet.")).toBeInTheDocument();
  });
});
