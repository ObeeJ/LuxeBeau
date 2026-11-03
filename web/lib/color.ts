/**
 * Fashion & Beauty Curated Colour Families & Client-side Colour Extraction
 * Specification: PRD docs/prd-storefronts.md Section 7
 */

export interface ColorFamily {
  name: string;
  category: "Warm & Earthy" | "Reds & Berries" | "Pinks & Corals" | "Golds & Yellows" | "Greens & Naturals" | "Blues & Teals" | "Neutrals & Monochromes";
  hex: string;
  swatches: string[];
}

export const CURATED_COLOR_FAMILIES: ColorFamily[] = [
  // Warm & Earthy
  { name: "Terracotta", category: "Warm & Earthy", hex: "#E2725B", swatches: ["#F9DDD7", "#F0A89A", "#E2725B", "#B84730", "#782818"] },
  { name: "Warm Ochre", category: "Warm & Earthy", hex: "#CC7722", swatches: ["#F7E6D3", "#E8B880", "#CC7722", "#9C5410", "#5C2E05"] },
  { name: "Rich Cocoa", category: "Warm & Earthy", hex: "#6D4C41", swatches: ["#D7CCC8", "#A1887F", "#6D4C41", "#4E342E", "#2E1C18"] },
  { name: "Burnt Cinnamon", category: "Warm & Earthy", hex: "#8A3324", swatches: ["#ECC3BD", "#CA7A6D", "#8A3324", "#5D1E13", "#381009"] },
  { name: "Clay Brown", category: "Warm & Earthy", hex: "#8D5B4C", swatches: ["#EAD6D1", "#C29B8F", "#8D5B4C", "#633B2F", "#3B2018"] },

  // Reds & Berries
  { name: "Hibiscus Red", category: "Reds & Berries", hex: "#B7233D", swatches: ["#F4CCD4", "#E3748B", "#B7233D", "#821124", "#4E0713"] },
  { name: "Plum Noir", category: "Reds & Berries", hex: "#581845", swatches: ["#D4B9CE", "#9E598C", "#581845", "#3D0C2E", "#230419"] },
  { name: "Crimson Berry", category: "Reds & Berries", hex: "#900C3F", swatches: ["#ECC1D1", "#CE5C87", "#900C3F", "#610427", "#390115"] },
  { name: "Deep Ruby", category: "Reds & Berries", hex: "#841617", swatches: ["#E8C0C0", "#C46566", "#841617", "#5B0D0E", "#360506"] },

  // Pinks & Corals
  { name: "Blush Nude", category: "Pinks & Corals", hex: "#E8C5B8", swatches: ["#FAECE7", "#F2D7CE", "#E8C5B8", "#BF9687", "#7D5344"] },
  { name: "Coral Bloom", category: "Pinks & Corals", hex: "#F88379", swatches: ["#FDE1DF", "#FBAFA8", "#F88379", "#CA5247", "#852E26"] },
  { name: "Rose Mauve", category: "Pinks & Corals", hex: "#C08081", swatches: ["#F1DEDF", "#DCA5A6", "#C08081", "#965556", "#5C2F30"] },
  { name: "Dusty Peach", category: "Pinks & Corals", hex: "#E6B8A2", swatches: ["#F9EEE8", "#F1D2C3", "#E6B8A2", "#B8856E", "#724733"] },

  // Golds & Yellows
  { name: "Luxe Champagne", category: "Golds & Yellows", hex: "#C5A880", swatches: ["#F3ECE2", "#DFCDAF", "#C5A880", "#8F724D", "#584227"] },
  { name: "Nile Gold", category: "Golds & Yellows", hex: "#D4AF37", swatches: ["#F8F0D6", "#ECCF6E", "#D4AF37", "#9E7F18", "#5A4606"] },
  { name: "Amber Honey", category: "Golds & Yellows", hex: "#FFBF00", swatches: ["#FFF2CC", "#FFD966", "#FFBF00", "#B28500", "#664C00"] },

  // Greens & Naturals
  { name: "Sage Silk", category: "Greens & Naturals", hex: "#9CAF88", swatches: ["#E8EDE4", "#BDCBB0", "#9CAF88", "#6D8259", "#435234"] },
  { name: "Emerald Glaze", category: "Greens & Naturals", hex: "#046307", swatches: ["#C2EBC3", "#5EB561", "#046307", "#024204", "#012502"] },
  { name: "Olive Velvet", category: "Greens & Naturals", hex: "#556B2F", swatches: ["#D4DEC1", "#93A86B", "#556B2F", "#3A4B1D", "#212D0D"] },

  // Blues & Teals
  { name: "Midnight Indigo", category: "Blues & Teals", hex: "#1A2E40", swatches: ["#BACADA", "#5E81A2", "#1A2E40", "#0E1A25", "#060B10"] },
  { name: "Royal Teal", category: "Blues & Teals", hex: "#006666", swatches: ["#BCE6E6", "#4DB8B8", "#006666", "#004747", "#002929"] },

  // Neutrals & Monochromes
  { name: "Pure Obsidian", category: "Neutrals & Monochromes", hex: "#121212", swatches: ["#C4C4C4", "#666666", "#121212", "#080808", "#000000"] },
  { name: "Pebble Stone", category: "Neutrals & Monochromes", hex: "#7E7870", swatches: ["#ECEAE7", "#B5B0AA", "#7E7870", "#524E48", "#2F2C28"] },
];

/**
 * Extracts dominant accent colour from an image element or URL via an in-memory canvas.
 */
export async function extractDominantColor(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve("#C5A880");
        }

        // Downsample to 64x64 for speed and smoothing
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const data = ctx.getImageData(0, 0, size, size).data;
        let bestHex = "#C5A880";
        let bestScore = -1;

        // Iterate pixel samples
        for (let i = 0; i < data.length; i += 16) { // every 4th pixel
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent or near-black/near-white pixels
          if (a < 128) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const lum = (max + min) / 2;

          // Skip washed out whites/grays or muddy near-black
          if (lum < 30 || lum > 235 || delta < 25) continue;

          // Saturation score + delta vibrance
          const score = (delta / 255) * (1 - Math.abs(lum - 128) / 128);
          if (score > bestScore) {
            bestScore = score;
            bestHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
          }
        }

        resolve(bestHex);
      } catch (e) {
        resolve("#C5A880"); // fallback to brand champagne gold
      }
    };
    img.onerror = () => resolve("#C5A880");
    img.src = imageSrc;
  });
}
