import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("defaults to the brand purple pill at 44px", () => {
    render(<Button>Pay</Button>);
    const btn = screen.getByRole("button", { name: "Pay" });
    expect(btn.className).toContain("bg-brand");
    expect(btn.className).toContain("h-11");
    expect(btn.className).toContain("rounded-full");
  });

  it("has press feedback", () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn.className).toContain("active:scale-[.96]");
    expect(btn.className).toContain("active:opacity-75");
    expect(btn.className).toContain("hover:-translate-y-0.5");
  });

  it("supports the dark (deep purple) variant", () => {
    render(<Button variant="dark">How it works</Button>);
    expect(screen.getByRole("button", { name: "How it works" }).className).toContain("bg-brand-deep");
  });

  it("supports the secondary (white) variant", () => {
    render(<Button variant="secondary">Watch</Button>);
    expect(screen.getByRole("button", { name: "Watch" }).className).toContain("bg-surface");
  });

  it("ignores clicks when disabled", () => {
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Nope" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
