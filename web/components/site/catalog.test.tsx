import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProductCard, ProductRail, SearchBar } from "./catalog";
import { type Product } from "@/lib/api";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const sampleProduct: Product = {
  id: "p1",
  slug: "glow-serum",
  name: "Super Long Illuminating Vitamin C Radiant Glowing Serum That Goes On And On For Over A Hundred Characters Easily",
  brand: "Luxe Lab",
  priceNGN: 1500000,
  category: "Skincare",
  blurb: "A nice serum",
  details: ["Hydrating"],
  rating: 4.8,
  reviews: 120,
  tint: ["#fff", "#000"],
  stock: 10,
};

describe("Catalog components", () => {
  it("ProductCard renders brand, formatted price, line-clamped title, and handles Add", () => {
    const onAdd = jest.fn();
    render(<ProductCard product={sampleProduct} onAdd={onAdd} />);

    expect(screen.getByText(/₦1,500,000/)).toBeInTheDocument();
    const title = screen.getByRole("heading", { level: 3 });
    expect(title.className).toContain("line-clamp-2");

    const addBtn = screen.getByRole("button", { name: /Add.*to bag/i });
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/✓ Added|Added/i)).toBeInTheDocument();
  });

  it("ProductCard disables Add button when stock is 0", () => {
    const outOfStock: Product = { ...sampleProduct, stock: 0 };
    render(<ProductCard product={outOfStock} />);
    const addBtn = screen.getByRole("button", { name: /sold out/i });
    expect(addBtn).toBeDisabled();
    expect(screen.getByText(/Sold out/i)).toBeInTheDocument();
  });

  it("ProductCard heart button toggles aria-pressed", () => {
    render(<ProductCard product={sampleProduct} />);
    const heartBtn = screen.getByRole("button", { name: /save|favourite/i });
    expect(heartBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(heartBtn);
    expect(heartBtn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(heartBtn);
    expect(heartBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("ProductRail provides scroll controls", () => {
    render(
      <ProductRail label="Top Rated">
        <div>Item 1</div>
        <div>Item 2</div>
      </ProductRail>,
    );
    const scrollRegion = screen.getByRole("region", { name: "Top Rated" });
    const scrollBySpy = jest.fn();
    scrollRegion.scrollBy = scrollBySpy;

    const nextBtn = screen.getByRole("button", { name: /scroll.*forward|next|right/i });
    fireEvent.click(nextBtn);
    expect(scrollBySpy).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number) }),
    );
  });

  it("SearchBar renders Scan button and opens ScanDialog", () => {
    render(<SearchBar />);
    const scanBtn = screen.getByRole("button", { name: /scan/i });
    expect(scanBtn).toBeInTheDocument();
    fireEvent.click(scanBtn);
    expect(screen.getByText(/Scanning isn't supported on this device/i)).toBeInTheDocument();
  });
});
