import { render, screen, within } from "@testing-library/react";
import SiteShell from "./shell";

let mockPath = "/";
let mockCount = 0;
let mockUser: { name: string } | null = null;
const mockShow = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/store", () => ({
  useCart: () => ({ count: mockCount }),
  useAuth: (sel: (s: { user: typeof mockUser }) => unknown) => sel({ user: mockUser }),
}));

jest.mock("@/components/auth/auth-dialog", () => ({
  useAuthModal: (sel: (s: { show: typeof mockShow }) => unknown) => sel({ show: mockShow }),
}));

function rail() {
  return screen.getByRole("complementary", { name: "Primary" });
}

describe("SiteShell", () => {
  beforeEach(() => {
    mockPath = "/";
    mockCount = 0;
    mockUser = null;
    mockShow.mockClear();
  });

  it("shows the logo tile and the five nav links in the desktop rail", () => {
    render(<SiteShell footer={false}>content</SiteShell>);
    const r = within(rail());
    expect(r.getByRole("link", { name: "LuxeBeau home" })).toHaveAttribute("href", "/");
    for (const name of ["Home", "Shop", "Artisans", "Bag", "Account"]) {
      expect(r.getByRole("link", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
  });

  it("uses a purple logo tile and a white pill dock with 46px round buttons", () => {
    render(<SiteShell footer={false}>content</SiteShell>);
    const r = within(rail());
    expect(r.getByRole("link", { name: "LuxeBeau home" }).className).toContain("bg-brand");
    const dock = rail().querySelector("nav")!;
    expect(dock.className).toContain("rounded-full");
    expect(dock.className).toContain("bg-surface");
    const home = r.getByRole("link", { name: /^Home/ });
    expect(home.className).toContain("h-[46px]");
    expect(home.className).toContain("rounded-full");
  });

  it("marks only the active route with aria-current", () => {
    mockPath = "/shop/some-serum";
    render(<SiteShell footer={false}>content</SiteShell>);
    const r = within(rail());
    expect(r.getByRole("link", { name: /^Shop/ })).toHaveAttribute("aria-current", "page");
    expect(r.getByRole("link", { name: /^Home/ })).not.toHaveAttribute("aria-current");
    const current = rail().querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
  });

  it("shows the bag count, capped at 99+", () => {
    mockCount = 3;
    const { unmount } = render(<SiteShell footer={false}>content</SiteShell>);
    expect(within(rail()).getByRole("link", { name: /^Bag/ })).toHaveTextContent("3");
    unmount();
    mockCount = 120;
    render(<SiteShell footer={false}>content</SiteShell>);
    expect(within(rail()).getByRole("link", { name: /^Bag/ })).toHaveTextContent("99+");
  });

  it("offers Sign in when signed out", () => {
    render(<SiteShell footer={false}>content</SiteShell>);
    within(rail()).getByRole("button", { name: "Sign in" }).click();
    expect(mockShow).toHaveBeenCalledWith("signin");
  });

  it("links to the account when signed in", () => {
    mockUser = { name: "Ada Obi" };
    render(<SiteShell footer={false}>content</SiteShell>);
    expect(within(rail()).getByRole("link", { name: "Your account, Ada Obi" })).toHaveTextContent("AO");
  });
});
