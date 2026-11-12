import type { Metadata, Viewport } from "next";
import { preconnect } from "react-dom";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { FaviconAnimator } from "@/components/site/favicon-animator";
import { API_BASE, EDGE_BASE } from "@/lib/api";

/* Geist is the single typeface: 800 for headlines, 900 for the wordmark. */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  themeColor: "#8a1fc7",
};

export const metadata: Metadata = {
  title: "LuxeBeau, Nigeria's Luxury Beauty Marketplace",
  description:
    "Shop skincare, hair, grooming, fragrance and makeup for everyone, and book vetted beauty artisans. Your money is held in trust until your order arrives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Open the network connections early, while the page is still being parsed, so
  // the first API calls do not each pay for a fresh connection set-up. The edge
  // cache serves cookie-free reads; the API serves everything personal.
  const origin = (u: string) => { try { return new URL(u).origin; } catch { return ""; } };
  const edge = origin(EDGE_BASE);
  const api = origin(API_BASE);
  if (edge) preconnect(edge);
  if (api) preconnect(api, { crossOrigin: "use-credentials" });
  return (
    <html lang="en-NG" className={geist.variable} suppressHydrationWarning>
      <body>
        <FaviconAnimator />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
