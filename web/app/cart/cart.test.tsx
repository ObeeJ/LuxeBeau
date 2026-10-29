import { render, screen, fireEvent, within } from "@testing-library/react";
import CartPage from "./page";
import { useCart, useAuth } from "@/lib/store";
import { useAuthModal } from "@/components/auth/auth-dialog";

jest.mock("@/lib/store", () => ({
  useCart: jest.fn(),
  useAuth: jest.fn(),
}));

jest.mock("@/components/auth/auth-dialog", () => ({
  useAuthModal: jest.fn(),
}));

jest.mock("@/lib/queries", () => ({
  useCreateOrder: () => ({ mutate: jest.fn(), isPending: false }),
  useWallet: () => ({ data: undefined }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/cart",
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUseCart = useCart as unknown as jest.Mock;
const mockUseAuth = useAuth as unknown as jest.Mock;
const mockUseAuthModal = useAuthModal as unknown as jest.Mock;

describe("Cart and Checkout flow", () => {
  const showAuthModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthModal.mockReturnValue(showAuthModal);
  });

  it("shows Start shopping link when the bag is empty", () => {
    mockUseCart.mockReturnValue({
      detailed: [],
      count: 0,
      subtotalNGN: 0,
      setQty: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    });
    mockUseAuth.mockReturnValue(null);

    render(<CartPage />);
    expect(screen.getByText(/Your bag is empty/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Start shopping/i });
    expect(link).toHaveAttribute("href", "/shop");
  });

  it("calls showAuth when a signed-out user attempts to check out, and displays escrow notice", () => {
    mockUseCart.mockReturnValue({
      detailed: [
        {
          product: {
            id: "p1",
            slug: "serum",
            name: "Glow Serum",
            brand: "Luxe",
            priceNGN: 5000,
            imageUrl: "",
            tint: ["#fff", "#000"],
          },
          qty: 2,
        },
      ],
      count: 2,
      subtotalNGN: 10000,
      setQty: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    });

    mockUseAuth.mockImplementation((selector) =>
      typeof selector === "function" ? selector({ user: null }) : null,
    );

    render(<CartPage />);

    const aside = screen.getByRole("complementary", { name: "Order summary" });
    expect(within(aside).getByText(/LuxeBeau Escrow Protection/i)).toBeInTheDocument();

    const checkoutBtn = screen.getByRole("button", { name: /Checkout/i });
    fireEvent.click(checkoutBtn);

    expect(showAuthModal).toHaveBeenCalledWith(
      "signin",
      expect.any(Function),
      expect.stringContaining("Sign in to check out"),
    );
  });
});
