import { DURATION, EASE } from "./motion";

describe("motion tokens", () => {
  it("uses the measured easing curves", () => {
    expect(EASE.out).toEqual([0.22, 1, 0.36, 1]);
    expect(EASE.spring).toEqual([0.34, 1.56, 0.64, 1]);
    expect(EASE.std).toEqual([0.2, 0, 0, 1]);
  });

  it("uses the measured durations", () => {
    expect(DURATION.press).toBe(0.15);
    expect(DURATION.cascade).toBe(0.35);
    expect(DURATION.bounce).toBe(0.4);
    expect(DURATION.stack).toBe(0.52);
    expect(DURATION.rail).toBe(0.18);
  });
});
