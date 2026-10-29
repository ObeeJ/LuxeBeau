import { render, screen, act } from "@testing-library/react";
import { RotatingWord } from "./rotating-word";
import { HeroCard } from "./hero-card";
import { EscrowStrip } from "./escrow-strip";
import { JoinRow } from "./join-row";
import { type Product } from "@/lib/api";

jest.mock("@/lib/motion", () => {
  const actual = jest.requireActual("@/lib/motion");
  return {
    ...actual,
    usePrefersReducedMotion: jest.fn(() => false),
  };
});

const { usePrefersReducedMotion } = jest.requireMock("@/lib/motion");

const mockProducts: Product[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `p-${i}`,
  slug: `prod-${i}`,
  name: `Product ${i}`,
  brand: `Brand ${i}`,
  priceNGN: 5000 + i * 1000,
  category: "Skincare",
  blurb: "Blurb",
  details: [],
  rating: 4.8,
  reviews: 50,
  tint: ["#fff", "#000"],
  imageUrl: `https://example.com/img-${i}.jpg`,
  stock: 10,
}));

describe("Home sections", () => {
  beforeEach(() => {
    jest.useRealTimers();
    usePrefersReducedMotion.mockReturnValue(false);
  });

  describe("RotatingWord", () => {
    it("advances words with timer when motion is allowed", () => {
      jest.useFakeTimers();
      render(<RotatingWord words={["you", "her", "him", "us"]} intervalMs={2400} />);
      expect(screen.getByText("you")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(2400);
      });
      expect(screen.getByText("her")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(2400);
      });
      expect(screen.getByText("him")).toBeInTheDocument();
    });

    it("remains static on the first word when reduced motion is preferred", () => {
      jest.useFakeTimers();
      usePrefersReducedMotion.mockReturnValue(true);
      render(<RotatingWord words={["you", "her", "him", "us"]} intervalMs={2400} />);
      expect(screen.getByText("you")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByText("you")).toBeInTheDocument();
      expect(screen.queryByText("her")).not.toBeInTheDocument();
    });
  });

  describe("HeroCard", () => {
    it("has the required responsive aspect and height tokens and Start shopping link", () => {
      const { container } = render(<HeroCard floating={mockProducts} />);
      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain("aspect-[7/10]");
      expect(card.className).toContain("md:h-[440px]");
      expect(card.className).toContain("xl:aspect-[2.75/1]");
      expect(card.className).toContain("xl:max-h-[685px]");

      const shopLink = screen.getByRole("link", { name: /Start shopping/i });
      expect(shopLink).toHaveAttribute("href", "/shop");
    });

    it("hides floating items if fewer than 4 products are provided", () => {
      const { container } = render(<HeroCard floating={mockProducts.slice(0, 3)} />);
      expect(container.querySelectorAll(".lb-idle")).toHaveLength(0);
    });
  });

  describe("EscrowStrip", () => {
    it("renders exactly 3 steps and moving line", () => {
      render(<EscrowStrip />);
      const steps = screen.getAllByRole("listitem");
      expect(steps).toHaveLength(3);
      expect(screen.getByText(/You pay into escrow/i)).toBeInTheDocument();
      expect(screen.getByText(/Verified seller delivers/i)).toBeInTheDocument();
      expect(screen.getByText(/You confirm, they get paid/i)).toBeInTheDocument();
    });
  });

  describe("JoinRow", () => {
    it("renders links pointing to the three partnership paths", () => {
      render(<JoinRow />);
      const sellerLink = screen.getByRole("link", { name: /Sell on LuxeBeau/i });
      expect(sellerLink).toHaveAttribute("href", "/partnership/seller");

      const artisanLink = screen.getByRole("link", { name: /Fill your calendar|artisan/i });
      expect(artisanLink).toHaveAttribute("href", "/partnership/artisan");

      const brandLink = screen.getByRole("link", { name: /Brand partnerships/i });
      expect(brandLink).toHaveAttribute("href", "/partnership/seller#brands");
    });
  });
});
