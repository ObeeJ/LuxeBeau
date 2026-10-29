import { render, screen } from "@testing-library/react";
import { Cascade } from "./cascade";

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
}

describe("Cascade", () => {
  it("renders children fully visible when motion is reduced", () => {
    mockReducedMotion(true);
    render(
      <Cascade index={3}>
        <p>Hello</p>
      </Cascade>,
    );
    const wrapper = screen.getByText("Hello").parentElement as HTMLElement;
    expect(wrapper.style.opacity).not.toBe("0");
    expect(wrapper.getAttribute("style") ?? "").not.toMatch(/opacity:\s*0[;\s]|opacity:\s*0$/);
  });

  it("renders children when motion is allowed", () => {
    mockReducedMotion(false);
    render(
      <Cascade>
        <p>World</p>
      </Cascade>,
    );
    expect(screen.getByText("World")).toBeInTheDocument();
  });
});
