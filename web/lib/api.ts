import { z } from "zod";

/* Base URL for the Go (Gin) API. Override with NEXT_PUBLIC_API_URL in production. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

const TOKEN_KEY = "lb_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/* The Go API wraps every payload as { success, data, error }. */
const envelope = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({ code: z.string(), message: z.string() })
    .nullish(),
});

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
}

/* Single fetch wrapper: attaches the bearer token, unwraps the envelope,
   and turns API failures into a typed ApiError the UI can branch on. */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  { method = "GET", body, auth = false, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError("NETWORK", "Connection lost. Please check your internet connection and try again.", 0);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("BAD_RESPONSE", "We are experiencing temporary system issues. Please try again in a few moments.", res.status);
  }

  const parsed = envelope.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("BAD_RESPONSE", "We are experiencing temporary system issues. Please try again in a few moments.", res.status);
  }

  if (!parsed.data.success || !res.ok) {
    throw new ApiError(
      parsed.data.error?.code ?? "ERROR",
      parsed.data.error?.message ?? "Something went wrong. Please try again.",
      res.status,
    );
  }

  return schema.parse(parsed.data.data);
}

/* ── Schemas (shared between client validation and response typing) ── */

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["buyer", "seller", "artisan", "admin"]).catch("buyer"),
  phone: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  verified: z.boolean().optional().nullable(),
  cac_number: z.string().optional().nullable(),
  kyc_status: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
});
export type User = z.infer<typeof userSchema>;

/* ── Admin console: user governance ── */
export const adminUsersResponseSchema = z.object({ users: z.array(userSchema).nullish() });
export const adminUserResponseSchema = z.object({ user: userSchema });

export const authResultSchema = z.object({
  token: z.string(),
  user: userSchema,
});
export type AuthResult = z.infer<typeof authResultSchema>;

/* Nigerian phone: 11 digits starting 070/080/081/090/091, spaces tolerated. */
const phoneRule = z
  .string()
  .transform(v => v.replace(/\s+/g, ""))
  .refine(v => /^0[789][01]\d{8}$/.test(v), "Enter a valid Nigerian phone number, for example 0803 123 4567.");

export const registerSchema = z.object({
  name: z.string().min(2, "Enter your full name to continue."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Passwords must be at least eight characters."),
  phone: phoneRule,
  role: z.enum(["buyer", "seller", "artisan"]).default("buyer"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password to continue."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const deliverySchema = z.object({
  name: z.string().min(2, "Enter your full name so the dispatch rider can find you."),
  phone: phoneRule,
  address: z.string().min(8, "Enter your full street address, including a nearby landmark to guide the dispatch rider."),
  city: z.string().min(2, "Select your delivery city."),
  state: z.string().min(2, "Select your state."),
});
export type DeliveryInput = z.infer<typeof deliverySchema>;

/* Order + booking responses are best-effort: the marketplace stays usable in
   demo mode even before the Go API is reachable (see useCreateOrder). */
export const orderResultSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  reference: z.string().optional(),
  status: z.string().optional(),
});
export type OrderResult = z.infer<typeof orderResultSchema>;

export const bookingResultSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  reference: z.string().optional(),
  status: z.string().optional(),
});
export type BookingResult = z.infer<typeof bookingResultSchema>;

/* ── Catalogue: API shapes (snake_case, kobo) → display models (NGN) ──
   The Go schema is the source of truth. These schemas validate the wire
   format; the `to*` adapters convert to the camelCase, Naira shapes the
   UI renders, so no component touches kobo or snake_case directly. */

const idToString = z.union([z.string(), z.number()]).transform(String);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** kobo (int) → whole Naira */
const koboToNaira = (kobo: number) => Math.round(kobo / 100);

const DEFAULT_TINT: [string, string] = ["#3b2456", "#6d3fb8"];

export const apiProductSchema = z.object({
  id: idToString,
  slug: z.string().nullish(),
  name: z.string(),
  brand: z.string(),
  price: z.number(),
  original_price: z.number().nullish(),
  category: z.string(),
  stock: z.number().nullish(),
  rating: z.number().nullish(),
  reviews_count: z.number().nullish(),
  badge: z.string().nullish(),
  blurb: z.string().nullish(),
  details: z.array(z.string()).nullish(),
  bg_color: z.string().nullish(),
  fg_color: z.string().nullish(),
});
export type ApiProduct = z.infer<typeof apiProductSchema>;

export const productsResponseSchema = z.object({
  products: z.array(apiProductSchema),
});
export const productResponseSchema = z.object({ product: apiProductSchema });

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceNGN: number;
  category: string;
  blurb: string;
  details: string[];
  rating: number;
  reviews: number;
  badge?: string;
  tint: [string, string];
}

export function toProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    slug: p.slug || slugify(p.name),
    name: p.name,
    brand: p.brand,
    priceNGN: koboToNaira(p.price),
    category: p.category,
    blurb: p.blurb ?? "",
    details: p.details ?? [],
    rating: p.rating ?? 0,
    reviews: p.reviews_count ?? 0,
    badge: p.badge || undefined,
    tint: [p.bg_color || DEFAULT_TINT[0], p.fg_color || DEFAULT_TINT[1]],
  };
}

export const apiServiceSchema = z.object({
  name: z.string(),
  duration_mins: z.number().nullish(),
  price: z.number(),
  description: z.string().nullish(),
});

export const apiArtisanSchema = z.object({
  id: idToString,
  slug: z.string().nullish(),
  user: z.object({ name: z.string().nullish() }).nullish(),
  specialty: z.string().nullish(),
  craft: z.string().nullish(),
  studio: z.string().nullish(),
  price_from: z.number(),
  location: z.string().nullish(),
  city: z.string().nullish(),
  area: z.string().nullish(),
  rating: z.number().nullish(),
  jobs_completed: z.number().nullish(),
  verified: z.boolean().nullish(),
  bio: z.string().nullish(),
  bg_color: z.string().nullish(),
  fg_color: z.string().nullish(),
  services: z.array(apiServiceSchema).nullish(),
});
export type ApiArtisan = z.infer<typeof apiArtisanSchema>;

export const artisansResponseSchema = z.object({
  artisans: z.array(apiArtisanSchema),
});
export const artisanResponseSchema = z.object({ artisan: apiArtisanSchema });

export interface ArtisanService {
  name: string;
  durationMins: number;
  priceNGN: number;
  description: string;
}

export interface Artisan {
  id: string;
  slug: string;
  name: string;
  studio: string;
  craft: string;
  city: string;
  area: string;
  rating: number;
  bookings: number;
  fromNGN: number;
  verified: boolean;
  bio: string;
  services: ArtisanService[];
  tint: [string, string];
}

export function toArtisan(a: ApiArtisan): Artisan {
  return {
    id: a.id,
    slug: a.slug || slugify(a.user?.name || a.studio || a.id),
    name: a.user?.name || a.studio || "LuxeBeau Artisan",
    studio: a.studio ?? "",
    craft: a.craft || a.specialty || "",
    city: a.city ?? "",
    area: a.area ?? "",
    rating: a.rating ?? 0,
    bookings: a.jobs_completed ?? 0,
    fromNGN: koboToNaira(a.price_from),
    verified: a.verified ?? false,
    bio: a.bio ?? "",
    services: (a.services ?? []).map(s => ({
      name: s.name,
      durationMins: s.duration_mins ?? 0,
      priceNGN: koboToNaira(s.price),
      description: s.description ?? "",
    })),
    tint: [a.bg_color || DEFAULT_TINT[0], a.fg_color || DEFAULT_TINT[1]],
  };
}

/* ── Customer dashboard: orders & bookings ── */

export const apiOrderSchema = z.object({
  id: z.string(),
  total: z.number().nullish(),
  subtotal: z.number().nullish(),
  payment_status: z.string().nullish(),
  shipping_status: z.string().nullish(),
  created_at: z.string().nullish(),
  items: z
    .array(
      z.object({
        qty: z.number().nullish(),
        product: z.object({ name: z.string().nullish() }).nullish(),
      }),
    )
    .nullish(),
});
export const ordersResponseSchema = z.object({ orders: z.array(apiOrderSchema).nullish() });

export interface MyOrder {
  id: string;
  totalNGN: number;
  status: string;
  date: string;
  itemSummary: string;
}

export function toMyOrder(o: z.infer<typeof apiOrderSchema>): MyOrder {
  const items = o.items ?? [];
  const names = items.map(i => `${i.product?.name ?? "Item"}${(i.qty ?? 1) > 1 ? ` ×${i.qty}` : ""}`);
  return {
    id: o.id,
    totalNGN: koboToNaira(o.total ?? o.subtotal ?? 0),
    status: o.shipping_status || o.payment_status || "pending",
    date: (o.created_at ?? "").slice(0, 10),
    itemSummary: names.join(", ") || `${items.length} item(s)`,
  };
}

export const apiBookingSchema = z.object({
  id: z.string(),
  service_name: z.string().nullish(),
  booking_date: z.string().nullish(),
  booking_time: z.string().nullish(),
  service_type: z.string().nullish(),
  amount: z.number().nullish(),
  status: z.string().nullish(),
  artisan: z.object({ studio: z.string().nullish(), user: z.object({ name: z.string().nullish() }).nullish() }).nullish(),
  buyer: z.object({ name: z.string().nullish() }).nullish(),
});
export const bookingsResponseSchema = z.object({ bookings: z.array(apiBookingSchema).nullish() });

export interface MyBooking {
  id: string;
  service: string;
  with: string;
  date: string;
  time: string;
  priceNGN: number;
  status: string;
}

export function toMyBooking(b: z.infer<typeof apiBookingSchema>): MyBooking {
  return {
    id: b.id,
    service: b.service_name ?? "Service",
    with: b.artisan?.user?.name || b.artisan?.studio || b.buyer?.name || "",
    date: (b.booking_date ?? "").slice(0, 10),
    time: b.booking_time ?? "",
    priceNGN: koboToNaira(b.amount ?? 0),
    status: b.status ?? "pending",
  };
}

/* ── Escrow (held funds + B2B2C escrow links) ── */

export const escrowSchema = z.object({
  id: z.string(),
  kind: z.string(),
  reference: z.string().nullish(),
  buyer_id: z.string().nullish(),
  buyer_phone: z.string().nullish(),
  buyer_name: z.string().nullish(),
  payee_id: z.string().nullish(),
  title: z.string().nullish(),
  amount: z.number(),
  fee_bps: z.number().nullish(),
  state: z.string(),
  settlement_rail: z.string().nullish(),
  delivery_city: z.string().nullish(),
  service_type: z.string().nullish(),
  dispute_reason: z.string().nullish(),
  created_at: z.string().nullish(),
});
export type ApiEscrow = z.infer<typeof escrowSchema>;

export const myEscrowsResponseSchema = z.object({
  buying: z.array(escrowSchema).nullish(),
  selling: z.array(escrowSchema).nullish(),
});
export const escrowResponseSchema = z.object({ escrow: escrowSchema });
export const adminEscrowsResponseSchema = z.object({ escrows: z.array(escrowSchema).nullish() });

export interface Escrow {
  id: string;
  kind: string;
  title: string;
  amountNGN: number;
  state: string;
  rail: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  payeeId: string;
  deliveryCity: string;
  serviceType: string;
  disputeReason: string;
  date: string;
}

export function toEscrow(e: ApiEscrow): Escrow {
  return {
    id: e.id,
    kind: e.kind,
    title: e.title ?? "Escrow",
    amountNGN: koboToNaira(e.amount),
    state: e.state,
    rail: e.settlement_rail ?? "wallet",
    buyerId: e.buyer_id ?? "",
    buyerName: e.buyer_name ?? "",
    buyerPhone: e.buyer_phone ?? "",
    payeeId: e.payee_id ?? "",
    deliveryCity: e.delivery_city ?? "",
    serviceType: e.service_type ?? "",
    disputeReason: e.dispute_reason ?? "",
    date: (e.created_at ?? "").slice(0, 10),
  };
}
