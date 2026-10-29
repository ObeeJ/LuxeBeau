import { render, screen, fireEvent } from "@testing-library/react";
import Home from "./page";
import { useProducts, useArtisans } from "@/lib/queries";

jest.mock("@/lib/queries", () => ({
  useProducts: jest.fn(),
  useArtisans: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/store", () => ({
  useCart: () => ({ count: 0, add: jest.fn() }),
  useAuth: (fn: (s: { user: null }) => unknown) => fn({ user: null }),
}));

const mockUseProducts = useProducts as jest.Mock;
const mockUseArtisans = useArtisans as jest.Mock;

describe("Home page", () => {
  beforeEach(() => {
    mockUseArtisans.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  it("shows loading skeletons when products are loading", () => {
    mockUseProducts.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    });
    render(<Home />);
    const statuses = screen.getAllByRole("status", { name: "Loading" });
    expect(statuses.length).toBeGreaterThanOrEqual(1);
  });

  it("shows LoadError and retry button when products fail", () => {
    const refetch = jest.fn();
    mockUseProducts.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(<Home />);
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const retryBtns = screen.getAllByRole("button", { name: /try again/i });
    fireEvent.click(retryBtns[0]);
    expect(refetch).toHaveBeenCalled();
  });

  it("shows empty state when no products exist", () => {
    mockUseProducts.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    render(<Home />);
    const emptyMsgs = screen.getAllByText(/New products are on the way/i);
    expect(emptyMsgs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders rails with real products and no invented content", () => {
    const realProducts = Array.from({ length: 8 }).map((_, i) => ({
      id: `p-${i}`,
      slug: `product-${i}`,
      name: `Real Unique Product ${i}`,
      brand: `Authentic Unique Brand ${i}`,
      priceNGN: 7500,
      category: i % 2 === 0 ? "Skincare" : "Grooming",
      blurb: "",
      details: [],
      rating: 4.9,
      reviews: 42,
      tint: ["#fff", "#000"],
      stock: 5,
    }));

    mockUseProducts.mockReturnValue({
      data: realProducts,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    const { container } = render(<Home />);
    const matches = screen.getAllByText(/Real Unique Product 0/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Verify no fake content leaked
    const text = container.textContent || "";
    expect(text).not.toMatch(/Tolu|@kingsley|40,000/);
  });
});
