import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

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
    "Shop skincare, hair, grooming, fragrance and makeup for everyone, and book vetted beauty artisans. Your money is held in escrow until your order arrives.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-NG" className={geist.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
