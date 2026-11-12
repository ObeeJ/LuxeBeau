import test from "node:test";
import assert from "node:assert/strict";
import { checkAuth, parseMessage, parseAddress } from "../src/validate.js";

const OWNER = "owner@gmail.com";
const good = {
  from: "Luxebeau <owner@gmail.com>",
  to: "Ada Obi <ada@test.ng>",
  subject: "Your code",
  html: "<p>123456</p>",
  text: "123456",
};

test("checkAuth accepts only the exact bearer secret", () => {
  assert.equal(checkAuth("Bearer s3cret-value", "s3cret-value"), true);
  assert.equal(checkAuth("Bearer s3cret-valuE", "s3cret-value"), false);
  assert.equal(checkAuth("Bearer short", "s3cret-value"), false);
  assert.equal(checkAuth("s3cret-value", "s3cret-value"), false, "the Bearer prefix is required");
  assert.equal(checkAuth("", "s3cret-value"), false);
  assert.equal(checkAuth(null, "s3cret-value"), false);
});

test("checkAuth fails closed when no secret is configured", () => {
  assert.equal(checkAuth("Bearer ", ""), false);
  assert.equal(checkAuth("Bearer anything", ""), false);
  assert.equal(checkAuth("Bearer anything", undefined), false);
});

test("parseAddress splits a display name from the address", () => {
  assert.deepEqual(parseAddress("Ada Obi <ada@test.ng>"), { name: "Ada Obi", email: "ada@test.ng" });
  assert.deepEqual(parseAddress("ada@test.ng"), { name: "", email: "ada@test.ng" });
  assert.equal(parseAddress("not an address"), null);
  assert.equal(parseAddress("a@b.com, c@d.com"), null, "one recipient only");
  assert.equal(parseAddress("ada@test.ng\r\nBcc: evil@x.com"), null);
});

test("parseMessage accepts a good message and returns clean parts", () => {
  const r = parseMessage(good, OWNER);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.from, { name: "Luxebeau", email: "owner@gmail.com" });
  assert.deepEqual(r.value.to, { name: "Ada Obi", email: "ada@test.ng" });
  assert.equal(r.value.subject, "Your code");
});

test("parseMessage only sends as the owner's own address", () => {
  const r = parseMessage({ ...good, from: "Boss <ceo@bank.com>" }, OWNER);
  assert.equal(r.ok, false);
  assert.match(r.error, /sender/i);
  // Comparison ignores case.
  assert.equal(parseMessage({ ...good, from: "X <OWNER@Gmail.com>" }, OWNER).ok, true);
});

test("parseMessage refuses header injection and bad shapes", () => {
  for (const bad of [
    { ...good, subject: "hi\r\nBcc: evil@x.com" },
    { ...good, subject: "hi\nBcc: evil@x.com" },
    { ...good, to: "ada@test.ng\r\nBcc: evil@x.com" },
    { ...good, from: "Luxebeau <owner@gmail.com>\r\nX: y" },
    { ...good, to: "" },
    { ...good, subject: "" },
    { ...good, html: 42 },
    { ...good, text: undefined, html: undefined },
  ]) {
    assert.equal(parseMessage(bad, OWNER).ok, false, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(parseMessage(null, OWNER).ok, false);
  assert.equal(parseMessage("a string", OWNER).ok, false);
  assert.equal(parseMessage([good], OWNER).ok, false);
});

test("parseMessage enforces size limits", () => {
  assert.equal(parseMessage({ ...good, subject: "x".repeat(201) }, OWNER).ok, false);
  assert.equal(parseMessage({ ...good, html: "x".repeat(200_001) }, OWNER).ok, false);
  assert.equal(parseMessage({ ...good, text: "x".repeat(100_001) }, OWNER).ok, false);
  assert.equal(parseMessage({ ...good, html: "x".repeat(200_000) }, OWNER).ok, true);
});

test("parseMessage allows a text-only or html-only message", () => {
  assert.equal(parseMessage({ ...good, html: undefined }, OWNER).ok, true);
  assert.equal(parseMessage({ ...good, text: undefined }, OWNER).ok, true);
});
