import { z } from "zod";

/* Base URL for the Go (Gin) API. Override with NEXT_PUBLIC_API_URL in production. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

/* The Go API wraps every payload as { success, data, error }. */
const envelope = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({ code: z.string(), message: z.string(), details: z.unknown().optional() })
    .nullish(),
});

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Internal: set on the retry after a session refresh. */
  retried?: boolean;
}

/* Sessions live in HttpOnly cookies set by the API, so no token is ever
   readable from JavaScript. Every request sends cookies and the CSRF header
   the API requires on state-changing calls. */
const CSRF_HEADER = "X-LuxeBeau-Client";

let refreshing: Promise<boolean> | null = null;

/* One shared refresh for concurrent 401s: the refresh token is single-use,
   so parallel refreshes would trip the API's reuse detection. */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { [CSRF_HEADER]: "web" },
  })
    .then(r => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/* Single fetch wrapper: sends the session cookie, unwraps the envelope,
   refreshes an expired access token once, and turns failures into a typed
   ApiError the UI can branch on. */
export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  { method = "GET", body, signal, retried = false }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", [CSRF_HEADER]: "web" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError("NETWORK", "Connection lost. Check your internet connection and try again.", 0);
  }

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    if (await refreshSession()) return apiFetch(path, schema, { method, body, signal, retried: true });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("BAD_RESPONSE", "Something went wrong on our side. Please try again in a moment.", res.status);
  }

  const parsed = envelope.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("BAD_RESPONSE", "Something went wrong on our side. Please try again in a moment.", res.status);
  }

  if (!parsed.data.success || !res.ok) {
    throw new ApiError(
      parsed.data.error?.code ?? "ERROR",
      parsed.data.error?.message ?? "Something went wrong. Please try again.",
      res.status,
      parsed.data.error?.details,
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
  email_verified: z.boolean().optional().nullable(),
  created_at: z.string().optional().nullable(),
});
export type User = z.infer<typeof userSchema>;

/* ── Admin console: user governance ── */
export const adminUsersResponseSchema = z.object({ users: z.array(userSchema).nullish() });
export const adminUserResponseSchema = z.object({ user: userSchema });

/* POST /auth/login | /auth/verify-email | /auth/google | /auth/refresh,
   GET /auth/me → { user }. The session itself is set as cookies. */
export const sessionUserSchema = z.object({ user: userSchema });

/* POST /auth/register → verification is required before a session exists. */
export const registerResultSchema = z.object({
  verification_required: z.boolean(),
  email: z.string(),
});

/* Nigerian phone: 11 digits starting 070/080/081/090/091, spaces tolerated. */
const phoneRule = z
  .string()
  .transform(v => v.replace(/\s+/g, ""))
  .refine(v => /^0[789][01]\d{8}$/.test(v), "Enter a valid Nigerian phone number, for example 0803 123 4567.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.");
export type LoginInput = z.infer<typeof loginSchema>;

export const deliverySchema = z.object({
  name: z.string().min(2, "Enter your full name so the dispatch rider can find you."),
  phone: phoneRule,
  address: z.string().min(8, "Enter your full street address, including a nearby landmark to guide the dispatch rider."),
  city: z.string().min(2, "Select your delivery city."),
  state: z.string().min(2, "Select your state."),
});
export type DeliveryInput = z.infer<typeof deliverySchema>;

/* POST /orders → { order: Order }, POST /bookings → { booking: Booking }
   (api-go/internal/order/handler.go, booking/handler.go). Amounts are kobo. */
export const orderResultSchema = z
  .object({
    order: z.object({
      id: z.string(),
      total: z.number(),
      delivery_fee: z.number().nullish(),
      payment_status: z.string().nullish(),
      payment_method: z.string().nullish(),
    }),
  })
  .transform(({ order }) => ({
    id: order.id,
    totalNGN: Math.round(order.total / 100),
    deliveryFeeNGN: Math.round((order.delivery_fee ?? 0) / 100),
    paymentStatus: order.payment_status ?? "pending",
    paymentMethod: order.payment_method ?? "",
  }));
export type OrderResult = z.infer<typeof orderResultSchema>;

export const bookingResultSchema = z
  .object({
    booking: z.object({
      id: z.string(),
      amount: z.number().nullish(),
      status: z.string().nullish(),
      booking_date: z.string().nullish(),
      booking_time: z.string().nullish(),
    }),
  })
  .transform(({ booking }) => ({
    id: booking.id,
    amountNGN: Math.round((booking.amount ?? 0) / 100),
    status: booking.status ?? "pending",
  }));
export type BookingResult = z.infer<typeof bookingResultSchema>;

/* Mirrors CreateCheckout in api-go/internal/order/service.go: ₦1,500 delivery
   below a ₦10,000 subtotal, free above. The server total is authoritative. */
export function deliveryFeeNGN(subtotalNGN: number): number {
  return subtotalNGN > 0 && subtotalNGN < 10_000 ? 1_500 : 0;
}

/* GET /wallets/me → { wallet: Wallet } (balance in kobo). */
export const walletResponseSchema = z
  .object({ wallet: z.object({ balance: z.number() }) })
  .transform(({ wallet }) => ({ balanceNGN: Math.round(wallet.balance / 100) }));

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
  image_url: z.string().nullish(),
  seller_id: z.string().nullish(),
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
  imageUrl?: string;
  stock: number;
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
    imageUrl: p.image_url || undefined,
    stock: p.stock ?? 0,
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
  service_mode: z.enum(["studio", "home", "both"]).nullish(),
  image_url: z.string().nullish(),
  cancel_window_hours: z.number().nullish(),
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
  serviceMode: "studio" | "home" | "both";
  imageUrl?: string;
  location: string;
  /** Notice a client must give to cancel a confirmed booking for free; 0 means any time. */
  cancelWindowHours: number;
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
    serviceMode: a.service_mode ?? "studio",
    imageUrl: a.image_url || undefined,
    location: a.location ?? "",
    cancelWindowHours: a.cancel_window_hours ?? 24,
  };
}

/* ── Customer dashboard: orders & bookings ── */

export const apiOrderSchema = z.object({
  id: z.string(),
  total: z.number().nullish(),
  subtotal: z.number().nullish(),
  payment_status: z.string().nullish(),
  shipping_status: z.string().nullish(),
  payment_method: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  created_at: z.string().nullish(),
  buyer: z.object({ name: z.string().nullish() }).nullish(),
  holds: z
    .array(
      z.object({
        id: z.string(),
        state: z.string(),
        amount: z.number(),
        net: z.number().nullish(),
        seller: z.string().nullish(),
        release_eligible_at: z.string().nullish(),
      }),
    )
    .nullish(),
  items: z
    .array(
      z.object({
        id: z.number().nullish(),
        qty: z.number().nullish(),
        price: z.number().nullish(),
        fulfillment_status: z.string().nullish(),
        tracking_note: z.string().nullish(),
        product: z.object({ name: z.string().nullish(), brand: z.string().nullish(), image_url: z.string().nullish() }).nullish(),
      }),
    )
    .nullish(),
});
export const ordersResponseSchema = z.object({ orders: z.array(apiOrderSchema).nullish() });

export interface MyOrder {
  id: string;
  totalNGN: number;
  status: string;
  paymentStatus: string;
  shippingStatus: string;
  paymentMethod: string;
  city: string;
  date: string;
  itemSummary: string;
  items: OrderLine[];
  buyer: string;
  address: string;
  phone: string;
  /** Latest tracking note any seller left on the order. */
  trackingNote: string;
  /** Escrows holding the order's money, one per seller. */
  holds: OrderHold[];
}

export interface OrderHold {
  id: string;
  /** funded (held), released (seller paid), refunded, disputed */
  state: string;
  amountNGN: number;
  /** What the seller receives after the platform fee. */
  netNGN: number;
  seller: string;
  /** When the money releases to the seller if the buyer does nothing. Set once the seller marks the goods delivered. */
  releaseAt: string | null;
}

export interface OrderLine {
  name: string;
  qty: number;
  stage: string;
  note: string;
}

export function toMyOrder(o: z.infer<typeof apiOrderSchema>): MyOrder {
  const items = o.items ?? [];
  const names = items.map(i => `${i.product?.name ?? "Item"}${(i.qty ?? 1) > 1 ? ` ×${i.qty}` : ""}`);
  return {
    id: o.id,
    totalNGN: koboToNaira(o.total ?? o.subtotal ?? 0),
    status: o.shipping_status || o.payment_status || "pending",
    paymentStatus: o.payment_status || "pending",
    shippingStatus: o.shipping_status || "pending",
    paymentMethod: o.payment_method ?? "",
    city: o.city ?? "",
    date: (o.created_at ?? "").slice(0, 10),
    itemSummary: names.join(", ") || `${items.length} item(s)`,
    items: items.map(i => ({
      name: i.product?.name ?? "Item",
      qty: i.qty ?? 1,
      stage: i.fulfillment_status || "pending",
      note: i.tracking_note ?? "",
    })),
    buyer: o.buyer?.name ?? "",
    address: [o.address, o.city, o.state].filter(Boolean).join(", "),
    phone: o.phone ?? "",
    trackingNote: items.map(i => i.tracking_note).filter(Boolean).at(-1) ?? "",
    holds: (o.holds ?? []).map(h => ({
      id: h.id,
      state: h.state,
      amountNGN: koboToNaira(h.amount),
      netNGN: koboToNaira(h.net ?? h.amount),
      seller: h.seller ?? "",
      releaseAt: h.release_eligible_at ?? null,
    })),
  };
}

/* ── Artisan availability ── */

export const availabilityResponseSchema = z.object({
  days: z.array(z.object({ date: z.string(), times: z.array(z.string()) })).nullish(),
});
export type AvailableDay = { date: string; times: string[] };

export interface DayHours {
  weekday: number; // 0 = Sunday
  start: string; // HH:MM
  end: string;
}

export const scheduleSchema = z.object({
  weekly_hours: z.array(z.object({ weekday: z.number(), start: z.string(), end: z.string() })).nullish(),
  slot_minutes: z.number(),
  days_off: z.array(z.string()).nullish(),
  cancel_window_hours: z.number().nullish(),
});

export const slotSchema = z.object({
  id: z.number(),
  slot_date: z.string(),
  slot_time: z.string(),
  reserved: z.boolean().nullish(),
  source: z.string().nullish(),
});
export const slotsResponseSchema = z.object({ slots: z.array(slotSchema).nullish() });
export type Slot = z.infer<typeof slotSchema>;

/* ── Admin: partners awaiting approval ── */
export const applicationsResponseSchema = z.object({
  applications: z
    .array(
      z.object({
        user: userSchema,
        artisan: apiArtisanSchema.nullish(),
        products: z.number().nullish(),
      }),
    )
    .nullish(),
});
export type Application = NonNullable<z.infer<typeof applicationsResponseSchema>["applications"]>[number];

export const apiBookingSchema = z.object({
  id: z.string(),
  service_name: z.string().nullish(),
  booking_date: z.string().nullish(),
  booking_time: z.string().nullish(),
  service_type: z.string().nullish(),
  address: z.string().nullish(),
  amount: z.number().nullish(),
  status: z.string().nullish(),
  policy_hours: z.number().nullish(),
  cancelled_by: z.string().nullish(),
  cancel_reason: z.string().nullish(),
  late_cancel: z.boolean().nullish(),
  free_cancel_until: z.string().nullish(),
  buyer_strikes: z.number().nullish(),
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
  client: string;
  artisan: string;
  serviceType: string;
  address: string;
  /** Hours of notice the booking was made under; 0 means free to cancel any time. */
  policyHours: number;
  /** Until when cancelling is free (only for pending or confirmed bookings). */
  freeCancelUntil: string | null;
  cancelledBy: string;
  cancelReason: string;
  lateCancel: boolean;
  /** Late cancellations and no-shows by this client in the last 90 days (artisans only). */
  buyerStrikes: number;
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
    client: b.buyer?.name ?? "",
    artisan: b.artisan?.user?.name || b.artisan?.studio || "",
    serviceType: b.service_type ?? "",
    address: b.address ?? "",
    policyHours: b.policy_hours ?? 24,
    freeCancelUntil: b.free_cancel_until ?? null,
    cancelledBy: b.cancelled_by ?? "",
    cancelReason: b.cancel_reason ?? "",
    lateCancel: b.late_cancel ?? false,
    buyerStrikes: b.buyer_strikes ?? 0,
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
