import {
  BANKS, MIN_WITHDRAWAL_KOBO, afterResult, attemptSignature, bankName, hasActiveWithdrawal, isDefiniteResult,
  keyForAttempt, koboToNairaInput, maskAccount, nairaToKobo, validateWithdrawal, withdrawalStateInfo,
  withdrawalsResponseSchema, withdrawResponseSchema, type KeyStore,
} from "./withdrawals";

describe("naira <-> kobo", () => {
  it("converts without float drift", () => {
    expect(nairaToKobo("0.1")).toBe(10);
    expect(nairaToKobo(0.1 + 0.2)).toBeNull(); // 0.30000000000000004 is not a money amount
    expect(nairaToKobo("0.3")).toBe(30);
    expect(nairaToKobo("1,000")).toBe(100000);
    expect(nairaToKobo("1000.5")).toBe(100050);
    expect(nairaToKobo("₦5,000.25")).toBe(500025);
    expect(nairaToKobo("19.99")).toBe(1999);
  });
  it("rejects bad input", () => {
    for (const v of ["", "abc", "-5", "1.234", "1e3", "1..2"]) expect(nairaToKobo(v)).toBeNull();
  });
  it("round trips for the input box", () => {
    expect(koboToNairaInput(500000)).toBe("5000");
    expect(koboToNairaInput(100050)).toBe("1000.5");
    expect(koboToNairaInput(100005)).toBe("1000.05");
    expect(nairaToKobo(koboToNairaInput(123456))).toBe(123456);
  });
});

describe("validateWithdrawal", () => {
  it("accepts a good request", () => {
    expect(validateWithdrawal("5000", 600000, "0123456789")).toEqual({});
    expect(validateWithdrawal("1000", 100000, "0123456789")).toEqual({});
  });
  it("flags under minimum, over balance, empty, invalid", () => {
    expect(validateWithdrawal("999", 600000, "0123456789").amount).toMatch(/minimum/i);
    expect(validateWithdrawal("6000.01", 600000, "0123456789").amount).toMatch(/more than/i);
    expect(validateWithdrawal("", 600000, "0123456789").amount).toBeDefined();
    expect(validateWithdrawal("abc", 600000, "0123456789").amount).toBeDefined();
  });
  it("requires exactly 10 digits", () => {
    for (const a of ["", "123456789", "01234567890", "01234abcde"]) expect(validateWithdrawal("5000", 600000, a).account).toBeDefined();
  });
  it("minimum constant is N1,000", () => expect(MIN_WITHDRAWAL_KOBO).toBe(100000));
});

describe("maskAccount", () => {
  it("shows only the last 4", () => {
    expect(maskAccount("0123456789")).toBe("****6789");
    expect(maskAccount("12")).toBe("****");
    expect(maskAccount("")).toBe("****");
  });
});

describe("state mapping", () => {
  it("maps every state", () => {
    expect(withdrawalStateInfo("pending")).toMatchObject({ tone: "pending", active: true, returned: false });
    expect(withdrawalStateInfo("processing")).toMatchObject({ tone: "pending", active: true });
    expect(withdrawalStateInfo("succeeded")).toMatchObject({ tone: "success", active: false });
    expect(withdrawalStateInfo("failed")).toMatchObject({ tone: "failed", returned: true });
    expect(withdrawalStateInfo("reversed")).toMatchObject({ tone: "failed", returned: true });
    expect(withdrawalStateInfo("weird").active).toBe(false);
  });
  it("knows when to keep polling", () => {
    const w = (state: string) => ({ id: "1", amount: 1, bank_code: "", account_number: "", account_name: "", state, fail_reason: "", created_at: "" });
    expect(hasActiveWithdrawal([w("succeeded"), w("processing")])).toBe(true);
    expect(hasActiveWithdrawal([w("succeeded"), w("failed")])).toBe(false);
    expect(hasActiveWithdrawal(undefined)).toBe(false);
  });
});

describe("BANKS", () => {
  it("has unique codes and non-empty names", () => {
    const codes = BANKS.map(b => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const b of BANKS) {
      expect(b.name.trim()).not.toBe("");
      expect(b.code).toMatch(/^\d{3,6}$/);
    }
    expect(bankName("058")).toMatch(/GTBank/);
    expect(bankName("nope")).toBe("Bank");
  });
});

describe("idempotency key lifecycle", () => {
  let n = 0;
  const make = () => `key-${++n}`;
  const sig = attemptSignature(500000, "058", "0123456789");

  it("reuses the key while retrying the same attempt", () => {
    const a = keyForAttempt(null, sig, make);
    const store = afterResult(a.store, 0, false); // network error
    const b = keyForAttempt(store, sig, make);
    expect(b.key).toBe(a.key);
    const c = keyForAttempt(afterResult(b.store, 504, false), sig, make); // timeout / 5xx
    expect(c.key).toBe(a.key);
  });
  it("rotates after success or a definite 4xx", () => {
    const a = keyForAttempt(null, sig, make);
    expect(afterResult(a.store, 201, true)).toBeNull();
    for (const s of [400, 403, 409]) expect(afterResult(a.store, s, false)).toBeNull();
    expect(keyForAttempt(afterResult(a.store, 409, false), sig, make).key).not.toBe(a.key);
  });
  it("keeps the key for 408 / 429 / 5xx / network", () => {
    for (const s of [0, 408, 429, 500, 503]) expect(isDefiniteResult(s, false)).toBe(false);
  });
  it("rotates when amount or account changes", () => {
    const a = keyForAttempt(null, sig, make);
    const store: KeyStore = a.store;
    expect(keyForAttempt(store, attemptSignature(600000, "058", "0123456789"), make).key).not.toBe(a.key);
    expect(keyForAttempt(store, attemptSignature(500000, "058", "0123456780"), make).key).not.toBe(a.key);
    expect(keyForAttempt(store, attemptSignature(500000, "044", "0123456789"), make).key).not.toBe(a.key);
  });
});

describe("schemas", () => {
  it("treats null/missing history as empty", () => {
    expect(withdrawalsResponseSchema.parse({ withdrawals: null })).toEqual([]);
    expect(withdrawalsResponseSchema.parse({})).toEqual([]);
  });
  it("parses a withdrawal with nulls", () => {
    const w = withdrawalsResponseSchema.parse({
      withdrawals: [{ id: 1, amount: 500000, bank_code: "058", account_number: "0123456789", account_name: null, state: "failed", fail_reason: null, created_at: "2026-01-01T00:00:00Z" }],
    })[0];
    expect(w).toMatchObject({ id: "1", account_name: "", fail_reason: "", state: "failed" });
  });
  it("parses the create response", () => {
    const r = withdrawResponseSchema.parse({ withdrawal: { id: 2, amount: 100000, bank_code: "058", account_number: "0123456789", account_name: "ADA OBI", state: "processing", created_at: "x" } });
    expect(r.withdrawal.state).toBe("processing");
  });
});
