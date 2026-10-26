import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Product, type User } from "@/lib/api";

/* ── Auth store ──────────────────────────────────────────────
   Holds the signed-in profile for rendering. The session itself is an
   HttpOnly cookie the browser sends automatically; nothing sensitive is
   stored in JavaScript. `status` stays "loading" until the first /auth/me
   check so pages never flash a signed-out state. */
type AuthStatus = "loading" | "signedIn" | "signedOut";

interface AuthState {
  user: User | null;
  status: AuthStatus;
  signIn: (user: User) => void;
  signOut: () => void;
  isAuthed: () => boolean;
  updateUser: (user: Partial<User>) => void;
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  status: "loading",
  signIn: user => set({ user, status: "signedIn" }),
  signOut: () => set({ user: null, status: "signedOut" }),
  isAuthed: () => Boolean(get().user),
  updateUser: updated =>
    set(state => (state.user ? { user: { ...state.user, ...updated } } : {})),
}));

/* ── Cart store ──────────────────────────────────────────────
   Works signed out (window shopping) and persists in this browser. Each line
   keeps a snapshot for display; the API recalculates prices from the
   catalogue at checkout, so the server total is authoritative. */
export interface CartSnapshot {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceNGN: number;
  tint: [string, string];
  imageUrl?: string;
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
  return { id: p.id, slug: p.slug, name: p.name, brand: p.brand, priceNGN: p.priceNGN, tint: p.tint, imageUrl: p.imageUrl };
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
