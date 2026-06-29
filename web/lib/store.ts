import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clearToken, setToken, type Product, type User } from "@/lib/api";

/* ── Auth store ──────────────────────────────────────────────
   Zustand keeps the session globally; the JWT itself lives in
   localStorage (see lib/api) so apiFetch can attach it. */
interface AuthState {
  user: User | null;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  isAuthed: () => boolean;
  updateUser: (user: Partial<User>) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      signIn: (token, user) => {
        setToken(token);
        set({ user });
      },
      signOut: () => {
        clearToken();
        set({ user: null });
      },
      isAuthed: () => Boolean(get().user),
      updateUser: (updated) =>
        set((state) => {
          if (!state.user) return {};
          return { user: { ...state.user, ...updated } };
        }),
    }),
    { name: "lb_auth" },
  ),
);

/* ── Cart store ──────────────────────────────────────────────
   Each line carries a snapshot of the product (name, price, tint) taken at
   add-time. This decouples the cart from any catalogue source: the bag keeps
   working even if the product is later edited or the API is offline, and the
   price the buyer agreed to is the price that is charged. */
export interface CartSnapshot {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceNGN: number;
  tint: [string, string];
}

export interface CartLine extends CartSnapshot {
  qty: number;
}

interface CartState {
  lines: CartLine[];
  add: (product: CartSnapshot, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
}

function snapshot(p: Product | CartSnapshot): CartSnapshot {
  return { id: p.id, slug: p.slug, name: p.name, brand: p.brand, priceNGN: p.priceNGN, tint: p.tint };
}

export const useCartStore = create<CartState>()(
  persist(
    set => ({
      lines: [],
      add: (product, qty = 1) =>
        set(state => {
          const snap = snapshot(product);
          const existing = state.lines.find(l => l.id === snap.id);
          return existing
            ? { lines: state.lines.map(l => (l.id === snap.id ? { ...l, ...snap, qty: l.qty + qty } : l)) }
            : { lines: [...state.lines, { ...snap, qty }] };
        }),
      remove: id => set(state => ({ lines: state.lines.filter(l => l.id !== id) })),
      setQty: (id, qty) =>
        set(state => ({
          lines:
            qty <= 0
              ? state.lines.filter(l => l.id !== id)
              : state.lines.map(l => (l.id === id ? { ...l, qty } : l)),
        })),
      clear: () => set({ lines: [] }),
    }),
    { name: "lb_cart_v3" },
  ),
);

/* ── Theme store ─────────────────────────────────────────────
   Persists "dark" | "light" preference. ThemeApplier in
   providers.tsx syncs this to the <html> class on every mount. */
interface ThemeState {
  theme: "dark" | "light";
  toggleTheme: () => void;
  setTheme: (t: "dark" | "light") => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "lb_theme" },
  ),
);

/* Derived selector: exposes item count and subtotal plus a `detailed` view
   (shape kept stable for existing call sites) without a catalogue join. */
export function useCart() {
  const { lines, add, remove, setQty, clear } = useCartStore();
  const detailed = lines.map(l => ({ product: l as CartSnapshot & { priceNGN: number }, qty: l.qty }));
  return {
    lines,
    add,
    remove,
    setQty,
    clear,
    detailed,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotalNGN: lines.reduce((s, l) => s + l.priceNGN * l.qty, 0),
  };
}
