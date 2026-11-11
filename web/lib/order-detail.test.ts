import { formatKoboNaira, toOrderDetail } from "./order-detail";

const raw = {
  id: "LB-1", subtotal: 500000, delivery_fee: 150000, platform_fee: 15000, processing_fee: 10050, total: 675050,
  payment_status: "paid", shipping_status: "shipped",
  items: [
    { qty: 2, price: 150000, fulfillment_status: "shipped", tracking_note: "DHL 123", product: { name: "Shea butter", brand: "Eko" } },
    { qty: 1, price: 200000, product: { name: "Gele" } },
  ],
  holds: [{ id: "E1", state: "funded", amount: 300000, seller: "Eko" }],
};

describe("toOrderDetail", () => {
  it("keeps kobo exact and adds up", () => {
    const d = toOrderDetail(raw);
    expect(d.subtotalKobo + d.deliveryKobo + d.platformKobo + d.processingKobo).toBe(d.totalKobo);
    expect(d.items[0]).toMatchObject({ name: "Shea butter", qty: 2, lineKobo: 300000, note: "DHL 123" });
    expect(d.items[1].stage).toBe("pending");
    expect(d.order.holds).toHaveLength(1);
    expect(d.order.trackingNote).toBe("DHL 123");
  });
  it("survives missing fields", () => {
    const d = toOrderDetail({ id: "LB-2" });
    expect(d).toMatchObject({ subtotalKobo: 0, totalKobo: 0, items: [] });
  });
});

describe("formatKoboNaira", () => {
  it("shows kobo only when present", () => {
    expect(formatKoboNaira(150000)).toContain("1,500");
    expect(formatKoboNaira(150000)).not.toContain(".");
    expect(formatKoboNaira(10050)).toContain("100.50");
  });
});
