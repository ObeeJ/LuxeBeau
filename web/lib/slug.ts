/* URL slug for a brand name: lower case, accents and punctuation dropped,
   spaces to hyphens ("Ilé Beauty" becomes "ile-beauty"). */
export function brandSlug(brand: string): string {
  return brand
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
