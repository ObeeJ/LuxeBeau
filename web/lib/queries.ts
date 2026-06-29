import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  adminEscrowsResponseSchema,
  adminUserResponseSchema,
  adminUsersResponseSchema,
  apiFetch,
  ApiError,
  apiArtisanSchema,
  artisansResponseSchema,
  escrowResponseSchema,
  myEscrowsResponseSchema,
  toEscrow,
  authResultSchema,
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
  type ApiProduct,
  type Artisan,
  type DeliveryInput,
  type LoginInput,
  type Product,
  type RegisterInput,
} from "@/lib/api";

/* ── Catalogue queries (public, backend-driven) ──────────────
   The whole catalogue is small, so we fetch it once and filter on the
   client. Detail pages reuse the same cache via `select`, so navigating
   shop → product (or services → artisan) does not refetch. */

const CATALOGUE_STALE = 5 * 60 * 1000; // 5 minutes

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    staleTime: CATALOGUE_STALE,
    queryFn: async () => {
      const data = await apiFetch("/products?limit=100", productsResponseSchema);
      return data.products.map(toProduct);
    },
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["products"],
    staleTime: CATALOGUE_STALE,
    queryFn: async () => {
      const data = await apiFetch("/products?limit=100", productsResponseSchema);
      return data.products.map(toProduct);
    },
    select: (list: Product[]) => list.find(p => p.slug === slug || p.id === slug) ?? null,
  });
}

export function useArtisans() {
  return useQuery({
    queryKey: ["artisans"],
    staleTime: CATALOGUE_STALE,
    queryFn: async () => {
      const data = await apiFetch("/artisans", artisansResponseSchema);
      return data.artisans.map(toArtisan);
    },
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
      const data = await apiFetch("/me/orders", ordersResponseSchema, { auth: true });
      return (data.orders ?? []).map(toMyOrder);
    },
  });
}

export function useMyBookings(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "bookings"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/me/bookings", bookingsResponseSchema, { auth: true });
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
}

export function useMyProducts(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "products"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/me/products", productsResponseSchema, { auth: true });
      return data.products as ApiProduct[];
    },
  });
}

export function useMySales(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "sales"],
    enabled,
    queryFn: async () => {
      const data = await apiFetch("/me/sales", ordersResponseSchema, { auth: true });
      return (data.orders ?? []).map(toMyOrder);
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SellerProductInput) =>
      apiFetch("/me/products", productResponseSchema, { method: "POST", auth: true, body: input }),
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
      apiFetch(`/me/products/${id}`, productResponseSchema, { method: "PATCH", auth: true, body: input }),
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
      apiFetch(`/me/products/${id}`, z.object({ message: z.string() }), { method: "DELETE", auth: true }),
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
      const data = await apiFetch("/escrows", myEscrowsResponseSchema, { auth: true });
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
      apiFetch("/escrows", escrowResponseSchema, { method: "POST", auth: true, body: input }),
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
        auth: true,
        body: action === "dispute" ? { reason } : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "escrows"] });
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
      const data = await apiFetch(`/admin/escrows${qs}`, adminEscrowsResponseSchema, { auth: true });
      return (data.escrows ?? []).map(toEscrow);
    },
  });
}

export function useResolveEscrow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "release" | "refund" }) =>
      apiFetch(`/admin/escrows/${id}/resolve`, escrowResponseSchema, { method: "POST", auth: true, body: { decision } }),
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
      const data = await apiFetch(`/admin/users${qs ? `?${qs}` : ""}`, adminUsersResponseSchema, { auth: true });
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
      apiFetch(`/admin/users/${id}`, adminUserResponseSchema, { method: "PATCH", auth: true, body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useVerifyUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cac_number }: { id: string; cac_number?: string }) =>
      apiFetch(`/admin/users/${id}/verify`, adminUserResponseSchema, { method: "POST", auth: true, body: { cac_number } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/users/${id}`, z.object({ message: z.string() }), { method: "DELETE", auth: true }),
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
        auth: true,
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

// Re-export so existing imports of these types from queries keep working.
export type { Artisan, Product, User } from "@/lib/api";

/* Auth mutations hit the Go API directly and surface its error message. */
export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch("/auth/login", authResultSchema, { method: "POST", body: input }),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiFetch("/auth/register", authResultSchema, { method: "POST", body: input }),
  });
}

interface OrderPayload {
  items: { product_id: number; qty: number }[];
  delivery: DeliveryInput;
  pay_method: "card" | "transfer" | "ussd" | "wallet";
}

/* Checkout: POST /orders (protected). If the backend is not running yet we
   fall back to a synthesized reference so the marketplace stays demoable.
   Real payment failures (4xx) still throw and reach the user. */
export function useCreateOrder() {
  return useMutation({
    mutationFn: async (payload: OrderPayload) => {
      try {
        return await apiFetch("/orders", orderResultSchema, {
          method: "POST",
          auth: true,
          body: {
            items: payload.items,
            address: payload.delivery.address,
            city: payload.delivery.city,
            state: payload.delivery.state,
            phone: payload.delivery.phone,
            pay_method: payload.pay_method,
          },
        });
      } catch (err) {
        if (err instanceof ApiError && (err.code === "NETWORK" || err.status === 0)) {
          return { id: `LB-${Math.floor(100000 + Math.random() * 900000)}`, status: "demo" };
        }
        throw err;
      }
    },
  });
}

interface BookingPayload {
  artisan_id: number;
  service_name: string;
  date: string;
  slot_time: string;
  service_type: "home" | "studio" | "both";
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: async (payload: BookingPayload) => {
      try {
        return await apiFetch("/bookings", bookingResultSchema, {
          method: "POST",
          auth: true,
          body: payload,
        });
      } catch (err) {
        if (err instanceof ApiError && (err.code === "NETWORK" || err.status === 0)) {
          return { id: `BK-${Math.floor(1000 + Math.random() * 9000)}`, status: "demo" };
        }
        throw err;
      }
    },
  });
}

export interface OnboardArtisanInput {
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
        { method: "POST", auth: true, body: input }
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
        { method: "POST", auth: true, body: input }
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
        { auth: true }
      );
      return toArtisan(data.artisan);
    },
  });
}
