import { render, screen } from "@testing-library/react";
import { LuxeBeauLogo, LuxeBeauMark, LuxeBeauWordmark } from "./logo";

describe("Pair logo", () => {
  it("renders a home link with the two-ring mark and lowercase wordmark", () => {
    render(<LuxeBeauLogo />);
    const link = screen.getByRole("link", { name: "LuxeBeau home" });
    expect(link).toHaveAttribute("href", "/");
    const svg = link.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg!.querySelectorAll("circle")).toHaveLength(2);
    expect(link).toHaveTextContent(/^luxebeau$/);
  });

  it("draws the second ring at 60% opacity", () => {
    const { container } = render(<LuxeBeauMark />);
    const circles = container.querySelectorAll("circle");
    expect(circles[1]).toHaveAttribute("stroke-opacity", "0.6");
  });

  it("draws a purple tile behind the rings when asked", () => {
    const { container } = render(<LuxeBeauMark tile />);
    expect(container.querySelector("rect")).not.toBeNull();
  });

  it("wordmark is exactly luxebeau", () => {
    render(<LuxeBeauWordmark />);
    expect(screen.getByText("luxebeau")).toBeInTheDocument();
  });
});
