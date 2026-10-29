/* Colours for a category's art, as [edge, centre] to match Product.tint.
   Values come from the approved home mockup. Unknown categories get brand purple. */
const TINTS: Record<string, [string, string]> = {
  skincare: ["#f0b429", "#fff3d1"],
  hair: ["#2a0b48", "#5a3a2a"],
  haircare: ["#2a0b48", "#5a3a2a"],
  grooming: ["#6b8aa0", "#dfe9f0"],
  fragrance: ["#8a1fc7", "#f2d4ff"],
  makeup: ["#d6336c", "#ffe0ea"],
  body: ["#c8a27a", "#fbefe3"],
  nails: ["#b4235a", "#ffc4d6"],
  artisans: ["#6f16a3", "#e9d6ff"],
};

const FALLBACK: [string, string] = ["#6f16a3", "#e9d6ff"];

export function categoryTint(name: string): [string, string] {
  return TINTS[name.trim().toLowerCase()] ?? FALLBACK;
}
