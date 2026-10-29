import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { DEFAULT_PRODUCTS, DEFAULT_ARTISANS, CATEGORY_IMAGE_MAP } from "@/lib/catalog-data";
import {
  adminEscrowsResponseSchema,
  applicationsResponseSchema,
  availabilityResponseSchema,
  scheduleSchema,
  slotSchema,
  slotsResponseSchema,
  apiServiceSchema,
  type DayHours,
  adminUserResponseSchema,
  adminUsersResponseSchema,
  apiFetch,
  ApiError,
  apiArtisanSchema,
  artisansResponseSchema,
  escrowResponseSchema,
  myEscrowsResponseSchema,
  toEscrow,
  codeSchema,
  registerResultSchema,
  sessionUserSchema,
  bookingResultSchema,
  bookingsResponseSchema,
  orderResultSchema,
  ordersResponseSchema,
  productResponseSchema,
  productsResponseSchema,
  toArtisan,
  toMyBooking,
  toMyOrder,
  toProduct,
  walletResponseSchema,
  type ApiProduct,
  type Artisan,
  type DeliveryInput,
  type LoginInput,
  type Product,
  type RegisterInput,
  type User,
} from "@/lib/api";

/* ── Catalogue queries (public, backend-driven) ──────────────
   The whole catalogue is small, so we fetch it once and filter on the
   client. Detail pages reuse the same cache via `select`, so navigating
   shop → product (or services → artisan) does not refetch. */

const CATALOGUE_STALE = 5 * 60 * 1000; // 5 minutes

async function fetchProducts(search: string): Promise<Product[]> {
  try {
    const qs = new URLSearchParams({ limit: "100" });
    if (search) qs.set("search", search);
    const data = await apiFetch(`/products?${qs}`, productsResponseSchema);
    const list = data.products.map(toProduct);
    if (list.length > 0) {
      return list.map((p) => {
        if (!p.imageUrl) {
          const match = DEFAULT_PRODUCTS.find(
            (dp) => dp.slug === p.slug || dp.name.toLowerCase() === p.name.toLowerCase(),
          );
          return {
            ...p,
            imageUrl: match?.imageUrl || CATEGORY_IMAGE_MAP[p.category],
          };
        }
        return p;
      });
    }
  } catch {
    // Graceful fallback to rich local catalog when backend is offline
  }

  const normalized = search.trim().toLowerCase();
  return DEFAULT_PRODUCTS.filter(
    (p) =>
      !normalized ||
      p.name.toLowerCase().includes(normalized) ||
      p.brand.toLowerCase().includes(normalized) ||
      p.category.toLowerCase().includes(normalized),
  );
}

/* `search` is matched server-side (name/brand ILIKE, catalog/repository.go). */
export function useProducts(search = "") {
  return useQuery({
    queryKey: ["products", search],
    staleTime: CATALOGUE_STALE,
    queryFn: () => fetchProducts(search),
    initialData: () => {
      const normalized = search.trim().toLowerCase();
      return DEFAULT_PRODUCTS.filter(
        (p) =>
          !normalized ||
          p.name.toLowerCase().includes(normalized) ||
          p.brand.toLowerCase().includes(normalized) ||
          p.category.toLowerCase().includes(normalized),
      );
    },
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["products", ""],
    staleTime: CATALOGUE_STALE,
    queryFn: () => fetchProducts(""),
    select: (list: Product[]) => list.find(p => p.slug === slug || p.id === slug) ?? null,
  });
}

export function useArtisans() {
  return useQuery({
    queryKey: ["artisans"],
    staleTime: CATALOGUE_STALE,
    queryFn: async () => {
      try {
        const data = await apiFetch("/artisans", artisansResponseSchema);
        const list = data.artisans.map(toArtisan);
        if (list.length > 0) {
          return list.map((a) => {
            if (!a.imageUrl) {
              const match = DEFAULT_ARTISANS.find(
                (da) => da.slug === a.slug || da.name.toLowerCase() === a.name.toLowerCase(),
              );
              return { ...a, imageUrl: match?.imageUrl || "/images/artisans/amaka-eze.webp" };
            }
            return a;
          });
        }
      } catch {
        // Fallback to rich local catalog
      }
      return DEFAULT_ARTISANS;
    },
    initialData: () => DEFAULT_ARTISANS,
  });
}

export function useArtisan(slug: string) {
  return useQuery({
    queryKey: ["artisans"],
    staleTime: CATALOGUE_STALE,
    queryFn: async () => {
      const data = await apiFetch("/artisans", artisansResponseSchema);
      return data.artisans.map(toArtisan);
    },
    select: (list: Artisan[]) => list.find(a => a.slug === slug || a.id === slug) ?? null,
  });
}

/* ── Customer dashboard queries (protected) ── */

export function useMyOrders(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "orders"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/me/orders", ordersResponseSchema, {});
      return (data.orders ?? []).map(toMyOrder);
    },
  });
}

export function useMyBookings(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "bookings"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/me/bookings", bookingsResponseSchema, {});
      return (data.bookings ?? []).map(toMyBooking);
    },
  });
}

/* ── Seller dashboard (seller/admin; backend enforces RequireRole) ── */

export interface SellerProductInput {
  name: string;
  brand: string;
  price: number; // Kobo
  original_price?: number;
  category: string;
  stock: number;
  badge?: string;
  blurb?: string;
  details?: string[];
  bg_color?: string;
  fg_color?: string;
  image_url?: string;
}

export function useMyProducts(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "products"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/me/products", productsResponseSchema, {});
      return data.products as ApiProduct[];
    },
  });
}

export function useMySales(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "sales"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/me/sales", ordersResponseSchema, {});
      return (data.orders ?? []).map(toMyOrder);
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SellerProductInput) =>
      apiFetch("/me/products", productResponseSchema, { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SellerProductInput }) =>
      apiFetch(`/me/products/${id}`, productResponseSchema, { method: "PATCH", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/me/products/${id}`, z.object({ message: z.string() }), { method: "DELETE"}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/* ── Escrow (held funds + B2B2C escrow links) ── */

export function useMyEscrows(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "escrows"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/escrows", myEscrowsResponseSchema, {});
      return {
        buying: (data.buying ?? []).map(toEscrow),
        selling: (data.selling ?? []).map(toEscrow),
      };
    },
  });
}

export interface CreateEscrowInput {
  title: string;
  amount: number; // Kobo
  buyer_phone?: string;
  buyer_name?: string;
  delivery_city?: string;
  note?: string;
  rail?: string;
}

export function useCreateEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEscrowInput) =>
      apiFetch("/escrows", escrowResponseSchema, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "escrows"] }),
  });
}

/* One hook covers fund/release/refund/dispute — they share a shape. */
function useEscrowAction(action: "fund" | "release" | "refund" | "dispute") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/escrows/${id}/${action}`, escrowResponseSchema, {
        method: "POST",
        body: action === "dispute" ? { reason } : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "escrows"] });
      qc.invalidateQueries({ queryKey: ["me", "orders"] });
      qc.invalidateQueries({ queryKey: ["me", "sales"] });
      qc.invalidateQueries({ queryKey: ["me", "wallet"] });
      qc.invalidateQueries({ queryKey: ["admin", "escrows"] });
    },
  });
}

export const useFundEscrow = () => useEscrowAction("fund");
export const useReleaseEscrow = () => useEscrowAction("release");
export const useRefundEscrow = () => useEscrowAction("refund");
export const useDisputeEscrow = () => useEscrowAction("dispute");

export function useAdminEscrows(state: string) {
  const qs = state && state !== "all" ? `?state=${state}` : "";
  return useQuery({
    queryKey: ["admin", "escrows", state],
    queryFn: async () => {
      const data = await apiFetch(`/admin/escrows${qs}`, adminEscrowsResponseSchema, {});
      return (data.escrows ?? []).map(toEscrow);
    },
  });
}

export function useResolveEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "release" | "refund" }) =>
      apiFetch(`/admin/escrows/${id}/resolve`, escrowResponseSchema, { method: "POST", body: { decision } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "escrows"] }),
  });
}

/* ── Admin console (admin-only; backend enforces RequireRole) ── */

export interface AdminUserFilter {
  role?: string;
  status?: string;
  verified?: string;
  search?: string;
}

export function useAdminUsers(filter: AdminUserFilter) {
  const qs = new URLSearchParams(
    Object.entries(filter).filter(([, v]) => v && v !== "all") as [string, string][],
  ).toString();
  return useQuery({
    queryKey: ["admin", "users", filter],
    queryFn: async () => {
      const data = await apiFetch(`/admin/users${qs ? `?${qs}` : ""}`, adminUsersResponseSchema, {});
      return data.users ?? [];
    },
  });
}

interface UpdateUserVars {
  id: string;
  patch: Partial<{ role: string; status: string; jurisdiction: string; verified: boolean; kyc_status: string }>;
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateUserVars) =>
      apiFetch(`/admin/users/${id}`, adminUserResponseSchema, { method: "PATCH", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useVerifyUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cac_number }: { id: string; cac_number?: string }) =>
      apiFetch(`/admin/users/${id}/verify`, adminUserResponseSchema, { method: "POST", body: { cac_number } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "applications"] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/users/${id}`, z.object({ message: z.string() }), { method: "DELETE"}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

/* ── KYC (NIN/BVN via Prembly) ── */
export function useSubmitKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: "nin" | "bvn"; value: string }) =>
      apiFetch("/me/kyc", z.object({ kyc_status: z.string(), reference: z.string().optional() }), {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

// Re-export so existing imports of these types from queries keep working.
export type { Artisan, Product, User } from "@/lib/api";

/* ── Session (HttpOnly cookies set by the API) ── */

/* GET /auth/me: who is signed in. apiFetch refreshes an expired access
   token once; a 401 after that means signed out. */
export async function fetchSessionUser(): Promise<User | null> {
  try {
    const { user } = await apiFetch("/auth/me", sessionUserSchema);
    return user;
  } catch {
    return null;
  }
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch("/auth/login", sessionUserSchema, { method: "POST", body: input }),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch("/auth/register", registerResultSchema, { method: "POST", body: input }),
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (input: { email: string; code: string }) =>
      apiFetch("/auth/verify-email", sessionUserSchema, {
        method: "POST",
        body: { email: input.email, code: codeSchema.parse(input.code) },
      }),
  });
}

export function useResendCode() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch("/auth/resend-code", z.object({ message: z.string() }), { method: "POST", body: { email } }),
  });
}

/* Admin second step: the emailed sign-in code. */
export function useVerifyLogin() {
  return useMutation({
    mutationFn: (input: { email: string; code: string }) =>
      apiFetch("/auth/verify-login", sessionUserSchema, {
        method: "POST",
        body: { email: input.email, code: codeSchema.parse(input.code) },
      }),
  });
}

export function useGoogleSignIn() {
  return useMutation({
    mutationFn: (credential: string) =>
      apiFetch("/auth/google", sessionUserSchema, { method: "POST", body: { credential } }),
  });
}

export async function logout() {
  try {
    await apiFetch("/auth/logout", z.object({ message: z.string() }), { method: "POST" });
  } catch {
    /* Cookies are cleared server-side; a failed call still signs out locally. */
  }
}

interface OrderPayload {
  items: { product_id: number; qty: number }[];
  delivery: DeliveryInput;
  pay_method: "card" | "transfer" | "ussd" | "wallet";
}

/* Checkout: POST /orders (protected). Failures, including network errors,
   surface to the user; an order is never reported as placed unless the API
   created it. */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrderPayload) =>
      apiFetch("/orders", orderResultSchema, {
        method: "POST",
        body: {
          items: payload.items,
          address: payload.delivery.address,
          city: payload.delivery.city,
          state: payload.delivery.state,
          phone: payload.delivery.phone,
          pay_method: payload.pay_method,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

interface BookingPayload {
  artisan_id: number;
  service_name: string;
  date: string;
  slot_time: string;
  service_type: "home" | "studio";
  address?: string;
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookingPayload) =>
      apiFetch("/bookings", bookingResultSchema, { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "bookings"] }),
  });
}

export interface OnboardArtisanInput {
  service_mode: "studio" | "home" | "both";
  image_url?: string;
  specialty: string;
  craft: string;
  studio: string;
  price_from: number;
  location: string;
  city: string;
  area: string;
  bio?: string;
}

export interface OnboardSellerInput {
  cac_number: string;
}

export function useOnboardArtisan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OnboardArtisanInput) =>
      apiFetch(
        "/me/artisan-onboard",
        z.object({ message: z.string(), profile: apiArtisanSchema }),
        { method: "POST", body: input }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["artisans"] });
    },
  });
}

export function useOnboardSeller() {
  return useMutation({
    mutationFn: (input: OnboardSellerInput) =>
      apiFetch(
        "/me/seller-onboard",
        z.object({ message: z.string() }),
        { method: "POST", body: input }
      ),
  });
}

/* ── Artisan dashboard: own profile (protected) ── */

export function useMyArtisanProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "artisan"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch(
        "/me/artisan",
        z.object({ artisan: apiArtisanSchema }),
        {}
      );
      return toArtisan(data.artisan);
    },
  });
}

/* ── Wallet (GET /wallets/me) ── */
export function useWallet(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "wallet"],
    enabled,
    queryFn: () => apiFetch("/wallets/me", walletResponseSchema, {}),
  });
}

/* ── Artisan: confirm an incoming booking (PATCH /bookings/:id/confirm) ── */
export function useConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/bookings/${id}/confirm`, z.object({ message: z.string() }), { method: "PATCH"}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "bookings"] }),
  });
}

/* ── Booking lifecycle: cancel (client, artisan or admin), then complete / no-show (artisan) ── */
function useBookingAction<V extends { id: string }>(request: (v: V) => { path: string; method: "POST" | "PATCH"; body?: unknown }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => {
      const r = request(v);
      return apiFetch(r.path, z.object({ booking: z.unknown() }), { method: r.method, body: r.body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "bookings"] });
      qc.invalidateQueries({ queryKey: ["me", "slots"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
      qc.invalidateQueries({ queryKey: ["artisans"] });
    },
  });
}

export const useCancelBooking = () =>
  useBookingAction<{ id: string; reason?: string }>(v => ({ path: `/bookings/${v.id}/cancel`, method: "POST", body: { reason: v.reason ?? "" } }));
export const useCompleteBooking = () =>
  useBookingAction<{ id: string }>(v => ({ path: `/bookings/${v.id}/complete`, method: "PATCH" }));
export const useMarkNoShow = () =>
  useBookingAction<{ id: string }>(v => ({ path: `/bookings/${v.id}/no-show`, method: "PATCH" }));

/* ── Admin: marketplace records (GET /admin/orders|bookings|products) ── */
export function useAdminOrders(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "orders"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/admin/orders", ordersResponseSchema, {});
      return (data.orders ?? []).map(toMyOrder);
    },
  });
}

export function useAdminBookings(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "bookings"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/admin/bookings", bookingsResponseSchema, {});
      return (data.bookings ?? []).map(toMyBooking);
    },
  });
}

export function useAdminProducts(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "products"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/admin/products", productsResponseSchema, {});
      return data.products.map(toProduct);
    },
  });
}

export function useAdminDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/products/${id}`, z.object({ message: z.string() }), { method: "DELETE"}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

/* ── Photo upload: POST /me/uploads/image returns a one-time Cloudflare
   Images URL; the browser uploads the file there directly. ── */
const uploadSchema = z.object({ upload: z.object({ upload_url: z.string().url(), image_url: z.string().url() }) });

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function useImageUpload() {
  return useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith("image/")) throw new ApiError("BAD_FILE", "Choose a JPG, PNG or WebP image.", 400);
      if (file.size > MAX_IMAGE_BYTES) throw new ApiError("BAD_FILE", "Images must be 10 MB or smaller.", 400);
      const { upload } = await apiFetch("/me/uploads/image", uploadSchema, { method: "POST" });
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(upload.upload_url, { method: "POST", body: form });
      if (!res.ok) throw new ApiError("UPLOAD_FAILED", "The upload didn't finish. Please try again.", res.status);
      return upload.image_url;
    },
  });
}

/* ── Booking: real availability for one service (public) ── */
export function useAvailability(artisanId: string | undefined, service: string, days = 14) {
  return useQuery({
    queryKey: ["availability", artisanId, service, days],
    enabled: Boolean(artisanId && service),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const qs = new URLSearchParams({ service, days: String(days) });
      const data = await apiFetch(`/artisans/${artisanId}/availability?${qs}`, availabilityResponseSchema);
      return data.days ?? [];
    },
  });
}

/* ── Artisan studio: services, hours and one-off slots ── */

export interface ServiceInput {
  name: string;
  duration_mins: number;
  price: number; // naira
  description?: string;
}

export function useSaveServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (services: ServiceInput[]) =>
      apiFetch("/me/artisan/services", z.object({ services: z.array(apiServiceSchema) }), {
        method: "PUT",
        body: { services },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "artisan"] });
      qc.invalidateQueries({ queryKey: ["artisans"] });
    },
  });
}

export function useMySchedule(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "schedule"],
    enabled,
    queryFn: async () => {
      const s = await apiFetch("/me/artisan/schedule", scheduleSchema, {});
      return {
        weeklyHours: (s.weekly_hours ?? []) as DayHours[],
        slotMinutes: s.slot_minutes || 60,
        daysOff: s.days_off ?? [],
        cancelWindowHours: s.cancel_window_hours ?? 24,
      };
    },
  });
}

export function useSaveSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { weeklyHours: DayHours[]; slotMinutes: number; daysOff: string[]; cancelWindowHours: number }) =>
      apiFetch("/me/artisan/schedule", z.object({ message: z.string() }), {
        method: "PUT",
        body: {
          weekly_hours: input.weeklyHours,
          slot_minutes: input.slotMinutes,
          days_off: input.daysOff,
          cancel_window_hours: input.cancelWindowHours,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "schedule"] });
      qc.invalidateQueries({ queryKey: ["me", "slots"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useMySlots(enabled: boolean, days = 14) {
  return useQuery({
    queryKey: ["me", "slots", days],
    enabled,
    queryFn: async () => (await apiFetch(`/me/artisan/slots?days=${days}`, slotsResponseSchema, {})).slots ?? [],
  });
}

export function useAddSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; time: string }) =>
      apiFetch("/me/artisan/slots", z.object({ slot: slotSchema }), { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "slots"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useRemoveSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/me/artisan/slots/${id}`, z.object({ message: z.string() }), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "slots"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

/* ── Seller: move own items in an order forward ── */
export function useFulfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status, trackingNote }: { orderId: string; status: "processing" | "shipped" | "delivered"; trackingNote?: string }) =>
      apiFetch(`/me/sales/${encodeURIComponent(orderId)}`, z.object({ status: z.string(), order_status: z.string() }), {
        method: "PATCH",
        body: { status, tracking_note: trackingNote ?? "" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "sales"] }),
  });
}

/* ── Admin: partner applications ── */
export function useApplications(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "applications"],
    enabled,
    queryFn: async () => (await apiFetch("/admin/applications", applicationsResponseSchema, {})).applications ?? [],
  });
}
