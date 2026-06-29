import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LuxeBeau, Nigeria's Luxury Beauty Marketplace",
  description:
    "Shop curated beauty crafted for melanin-rich skin and book vetted artisans across Lagos, Abuja and Port Harcourt. Pay securely with Paystack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-NG" className={`${fraunces.variable} ${hanken.variable}`}>
      <body className="grain">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
