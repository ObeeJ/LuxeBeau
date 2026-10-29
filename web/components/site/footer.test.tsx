import { render, screen } from "@testing-library/react";
import SiteFooter from "./footer";

describe("SiteFooter", () => {
  it("renders the wordmark, proper columns, and clean copyright", () => {
    const { container } = render(<SiteFooter />);

    expect(screen.getAllByText(/^(luxe|beau)$/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Learn more")).toBeInTheDocument();
    expect(screen.getByText("Get started")).toBeInTheDocument();
    expect(screen.getByText("Legal")).toBeInTheDocument();

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear} LuxeBeau`))).toBeInTheDocument();

    const text = container.textContent || "";
    expect(text).not.toContain("App Store");
    expect(text).not.toContain("Google Play");
    expect(text).not.toContain("Lagos");
    expect(text).not.toContain("Abuja");
    expect(text).not.toContain("Port Harcourt");
  });
});
