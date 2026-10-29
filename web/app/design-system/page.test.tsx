import { render, screen } from "@testing-library/react";
import DesignSystemGallery, { metadata } from "./page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/design-system",
}));

describe("Component Gallery", () => {
  it("has robots noindex set in metadata", () => {
    expect(metadata.robots).toEqual(expect.objectContaining({ index: false }));
  });

  it("renders headings for all design system sections", () => {
    render(<DesignSystemGallery />);

    const sections = [
      "Colours",
      "Type",
      "Buttons",
      "Inputs",
      "Product card",
      "Rail",
      "Store card",
      "Search and Scan",
      "Toasts",
      "Logo",
    ];

    for (const title of sections) {
      expect(
        screen.getByRole("heading", { name: new RegExp(`^${title.replace(/\+/g, "\\+")}`, "i") }),
      ).toBeInTheDocument();
    }
  });
});
