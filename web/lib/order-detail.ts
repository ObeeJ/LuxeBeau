import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch, apiOrderSchema, toMyOrder, type MyOrder } from "@/lib/api";

/* One order for the buyer: GET /orders/:id returns the list fields plus the
   price breakdown and each item's price. Money arrives in kobo. */

const detailSchema = z.object({
  order: apiOrderSchema.extend({
    delivery_fee: z.number().nullish(),
    platform_fee: z.number().nullish(),
    processing_fee: z.number().nullish(),
    items: z
      .array(
        z.object({
          qty: z.number().nullish(),
          price: z.number().nullish(),
          fulfillment_status: z.string().nullish(),
          tracking_note: z.string().nullish(),
          product: z.object({ name: z.string().nullish(), brand: z.string().nullish() }).nullish(),
        }),
      )
      .nullish(),
  }),
});

export interface OrderDetailItem {
  name: string;
  brand: string;
  qty: number;
  stage: string;
  note: string;
  unitKobo: number;
  lineKobo: number;
}

export interface OrderDetail {
  order: MyOrder;
  items: OrderDetailItem[];
  subtotalKobo: number;
  deliveryKobo: number;
  platformKobo: number;
  processingKobo: number;
  totalKobo: number;
}

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function toOrderDetail(raw: z.infer<typeof detailSchema>["order"]): OrderDetail {
  const items = (raw.items ?? []).map(i => {
    const qty = n(i.qty) || 1;
    return {
      name: i.product?.name ?? "Item",
      brand: i.product?.brand ?? "",
      qty,
      stage: i.fulfillment_status || "pending",
      note: i.tracking_note ?? "",
      unitKobo: n(i.price),
      lineKobo: n(i.price) * qty,
    };
  });
  const subtotalKobo = n(raw.subtotal) || items.reduce((s, i) => s + i.lineKobo, 0);
  const deliveryKobo = n(raw.delivery_fee);
  const platformKobo = n(raw.platform_fee);
  const processingKobo = n(raw.processing_fee);
  return {
    order: toMyOrder(raw as z.infer<typeof apiOrderSchema>),
    items,
    subtotalKobo,
    deliveryKobo,
    platformKobo,
    processingKobo,
    totalKobo: n(raw.total) || subtotalKobo + deliveryKobo + platformKobo + processingKobo,
  };
}

/** Kobo as naira text with kobo kept ("₦1,500.50"), so a breakdown adds up on screen. */
export function formatKoboNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: kobo % 100 === 0 ? 0 : 2 }).format(kobo / 100);
}

export function useOrderDetail(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["me", "orders", id],
    enabled: enabled && id.length > 0,
    queryFn: async () => toOrderDetail((await apiFetch(`/orders/${encodeURIComponent(id)}`, detailSchema, {})).order),
  });
}
