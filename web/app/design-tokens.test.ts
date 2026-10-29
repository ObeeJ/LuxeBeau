/**
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { join } from "path";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");

describe("design tokens", () => {
  it("defines the brand purple palette", () => {
    const lower = css.toLowerCase();
    expect(lower).toContain("#8a1fc7");
    expect(lower).toContain("#6f16a3");
    expect(lower).toContain("#f3e6fb");
    expect(lower).toContain("#fafafa");
  });

  it("no longer uses the old blue-violet", () => {
    expect(css.toLowerCase()).not.toContain("#5433eb");
    expect(css).not.toMatch(/69,\s*36,\s*219/);
  });

  it("loads Geist, not Inter", () => {
    expect(layout).toMatch(/import\s*\{[^}]*\bGeist\b[^}]*\}\s*from\s*["']next\/font\/google["']/);
    expect(layout).not.toMatch(/\bInter\b/);
  });

  it("adds a non-interactive global grain overlay", () => {
    const rule = css.match(/body::after\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toContain("feTurbulence");
    expect(rule).toContain("pointer-events: none");
    expect(rule).toContain("mix-blend-mode: multiply");
  });
});
