import { render, screen, fireEvent } from "@testing-library/react";
import { FeaturedSpotlight } from "./featured-spotlight";
import { useFeaturedAds, useRecordAdClick } from "@/lib/queries";

jest.mock("@/lib/queries", () => ({
  useFeaturedAds: jest.fn(),
  useRecordAdClick: jest.fn(),
}));

const mockUseFeaturedAds = useFeaturedAds as jest.Mock;
const mockUseRecordAdClick = useRecordAdClick as jest.Mock;

describe("FeaturedSpotlight Component", () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    mockUseRecordAdClick.mockReturnValue({ mutate: mockMutate });
    mockUseFeaturedAds.mockReturnValue({
      data: [
        {
          id: "ad-1",
          merchant_id: "m-1",
          type: "storefront",
          target_id: "adunni-organics",
          title: "Adunni Organics",
          tagline: "Handcrafted Luxury Skincare",
          description: "Cold-processed botanical formulations.",
          badge: "Featured Brand",
          image_url: "https://example.com/adunni.jpg",
          link_url: "/s/adunni-organics",
          plan: "annual",
          amount_kobo: 12000000,
          status: "active",
        },
        {
          id: "ad-2",
          merchant_id: "m-1",
          type: "product",
          target_id: "ose-dudu",
          title: "Ọsẹ Dúdú Honey Cleansing Bar",
          tagline: "Whipped raw African black soap",
          description: "Cold-processed with wild honey and shea.",
          badge: "Spotlight Product",
          image_url: "https://example.com/ose.jpg",
          link_url: "/shop/ose-dudu",
          plan: "30_days",
          amount_kobo: 1500000,
          status: "active",
        },
      ],
      isLoading: false,
    });
  });

  it("renders the featured spotlight card with verified partner badges", () => {
    render(<FeaturedSpotlight />);

    expect(screen.getByText("Adunni Organics")).toBeInTheDocument();
    expect(screen.getByText("Handcrafted Luxury Skincare")).toBeInTheDocument();
    expect(screen.getByText(/Curated Spotlight/i)).toBeInTheDocument();
    expect(screen.getByText("Explore Storefront")).toBeInTheDocument();
  });

  it("switches to the next featured ad when selector indicator is clicked", () => {
    render(<FeaturedSpotlight />);

    const buttons = screen.getAllByRole("button", { name: /View featured item/i });
    expect(buttons.length).toBe(2);

    fireEvent.click(buttons[1]);

    expect(screen.getByText("Ọsẹ Dúdú Honey Cleansing Bar")).toBeInTheDocument();
    expect(screen.getByText(/Top Formulation/i)).toBeInTheDocument();
    expect(screen.getByText("Shop Featured Product")).toBeInTheDocument();
  });

  it("calls click tracking mutation when action link is clicked", () => {
    render(<FeaturedSpotlight />);

    const ctaLink = screen.getByText("Explore Storefront").closest("a");
    expect(ctaLink).toHaveAttribute("href", "/s/adunni-organics");

    fireEvent.click(ctaLink!);
    expect(mockMutate).toHaveBeenCalledWith("ad-1");
  });
});
