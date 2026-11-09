import {
  DEFAULT_FEE_KOBO, defaultRows, formatFee, hasCatchAll, isDirty, koboToNairaText, nairaToKobo,
  nairaTextToKobo, normalize, validate, zonesResponseSchema, type ZoneRow,
} from "./delivery-zones";

const row = (city: string, naira: string, key = city + naira): ZoneRow => ({ key, city, naira });

describe("naira <-> kobo", () => {
  it("avoids float drift", () => {
    expect(nairaToKobo(0.1 + 0.2)).toBe(30);
    expect(nairaToKobo(1500.5)).toBe(150050);
    expect(nairaTextToKobo("1500.50")).toBe(150050);
    expect(nairaTextToKobo("19.99")).toBe(1999);
    expect(nairaTextToKobo("0.1")).toBe(10);
    expect(nairaTextToKobo("1,500")).toBe(150000);
    expect(nairaTextToKobo("5.")).toBe(500);
  });
  it("rejects bad text", () => {
    for (const t of ["", "abc", "-1", "1.234", "1e5", "NaN", "Infinity", "1..2"]) expect(nairaTextToKobo(t)).toBeNull();
  });
  it("formats kobo for inputs", () => {
    expect(koboToNairaText(0)).toBe("0");
    expect(koboToNairaText(150000)).toBe("1500");
    expect(koboToNairaText(150050)).toBe("1500.50");
    expect(koboToNairaText(1005)).toBe("10.05");
  });
  it("displays fees", () => {
    expect(formatFee(0)).toBe("Free");
    expect(formatFee(150000)).toContain("1,500");
    expect(formatFee(150050)).toContain("1,500.50");
  });
});

describe("validate", () => {
  it("needs at least one row", () => {
    const r = validate([]);
    expect(r.valid).toBe(false);
    expect(r.form).toBeTruthy();
  });
  it("accepts good rows including free and catch-all", () => {
    expect(validate([row("Lagos", "0"), row("", "1500")]).valid).toBe(true);
  });
  it("flags negative, empty, non-numeric and over-cap fees", () => {
    const r = validate([row("A", "-5", "a"), row("B", "", "b"), row("C", "x", "c"), row("D", "100000.01", "d"), row("E", "100000", "e")]);
    expect(Object.keys(r.rows).sort()).toEqual(["a", "b", "c", "d"]);
    expect(r.rows.d.fee).toBeTruthy();
  });
  it("flags duplicate cities ignoring case and spaces", () => {
    const r = validate([row("Lagos", "1", "a"), row("  lagos ", "2", "b")]);
    expect(r.valid).toBe(false);
    expect(r.rows.a).toBeUndefined();
    expect(r.rows.b.city).toBeTruthy();
  });
  it("flags two catch-all rows", () => {
    expect(validate([row("", "1", "a"), row("  ", "2", "b")]).rows.b.city).toBeTruthy();
  });
});

describe("normalize / hasCatchAll / defaults", () => {
  it("trims, converts to kobo, puts catch-all last", () => {
    expect(normalize([row("", "1500"), row(" Lagos ", "800.50"), row("Abuja", "0")])).toEqual([
      { city: "Abuja", feeKobo: 0 }, { city: "Lagos", feeKobo: 80050 }, { city: "", feeKobo: 150000 },
    ]);
  });
  it("detects a catch-all", () => {
    expect(hasCatchAll([row("Lagos", "1")])).toBe(false);
    expect(hasCatchAll([row(" ", "1")])).toBe(true);
  });
  it("first-time default is one catch-all at the platform fee", () => {
    const d = defaultRows();
    expect(d).toHaveLength(1);
    expect(normalize(d)).toEqual([{ city: "", feeKobo: DEFAULT_FEE_KOBO }]);
  });
});

describe("isDirty", () => {
  const orig = [{ city: "Lagos", feeKobo: 80000 }, { city: "", feeKobo: 150000 }];
  it("is false for the same data, any order, case or spacing", () => {
    expect(isDirty(orig, [row("", "1500"), row(" lagos", "800")])).toBe(false);
  });
  it("is true when a fee, city, or row count changes", () => {
    expect(isDirty(orig, [row("Lagos", "801"), row("", "1500")])).toBe(true);
    expect(isDirty(orig, [row("Abuja", "800"), row("", "1500")])).toBe(true);
    expect(isDirty(orig, [row("Lagos", "800")])).toBe(true);
  });
  it("treats unparseable fee text as changed", () => {
    expect(isDirty(orig, [row("Lagos", "8x"), row("", "1500")])).toBe(true);
  });
});

describe("zonesResponseSchema", () => {
  it("handles null, missing and real zones", () => {
    expect(zonesResponseSchema.parse({ zones: null })).toEqual([]);
    expect(zonesResponseSchema.parse({})).toEqual([]);
    expect(zonesResponseSchema.parse({ zones: [{ id: 1, seller_id: "s", city: "Lagos", fee_kobo: 150000 }] })).toEqual([{ city: "Lagos", feeKobo: 150000 }]);
  });
  it("rejects fractional kobo", () => {
    expect(() => zonesResponseSchema.parse({ zones: [{ city: "x", fee_kobo: 1.5 }] })).toThrow();
  });
});
