/* Compressed WebP photography in /public/images/photos, matched to what each
   picture actually shows. Products and artisans without an uploaded photo get
   a fitting one from here; a seller's own upload always wins. */

const dir = "/images/photos";
const p = (name: string) => `${dir}/${name}.webp`;

export const HERO_PHOTOS = [p("hero-her"), p("hero-him")] as const;

/* Cover for "Book an artisan" tiles and pills. */
export const ARTISAN_COVER = p("braids-box");

const BY_CATEGORY: Record<string, string[]> = {
  skincare: ["skin-headband", "skin-cream", "skin-mask-man", "facial-treatment"].map(p),
  makeup: ["makeup-gloss", "makeup-palette"].map(p),
  fragrance: ["fragrance-fire", "fragrance-interdit", "fragrance-sauvage", "fragrance-reef", "fragrance-black-iris"].map(p),
  body: ["bath-routine", "body-lotion", "grooming-bath"].map(p),
  haircare: ["hair-products", "hair-tools", "hair-wig", "hair-updo", "hair-man"].map(p),
  hair: ["hair-products", "hair-tools", "hair-wig", "hair-updo", "hair-man"].map(p),
  grooming: ["grooming-mask-man", "grooming-bath", "hair-man", "bath-routine"].map(p),
  nails: ["nails-red", "nails-tech", "nails-watch-rings"].map(p),
};

/* Same seed always gives the same photo, so a product never changes picture. */
function pick(list: string[], seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export function categoryPhotos(category: string): string[] {
  return BY_CATEGORY[category.trim().toLowerCase()] ?? [];
}

export function categoryPhoto(category: string, seed: string): string | undefined {
  const list = BY_CATEGORY[category.trim().toLowerCase()];
  return list ? pick(list, seed) : undefined;
}

/* Artisans: matched on what they do. */
export function artisanPhoto(craft: string, seed: string): string | undefined {
  const c = craft.toLowerCase();
  if (/braid|twist|loc|cornrow|hair|stylist|gele|wig/.test(c)) return pick(["braids-top", "braids-box", "braids-bw", "hair-updo"].map(p), seed);
  if (/nail|mani|pedi|gel/.test(c)) return pick(["nails-tech", "nails-red", "nails-watch-rings"].map(p), seed);
  if (/facial|skin|glow|peel/.test(c)) return p("facial-treatment");
  if (/makeup|mua|glam|bridal/.test(c)) return pick(["makeup-palette", "makeup-gloss"].map(p), seed);
  if (/barber|fade|beard|groom/.test(c)) return pick(["hair-man", "grooming-bath", "grooming-mask-man"].map(p), seed);
  return undefined;
}
