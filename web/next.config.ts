import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/login", destination: "/dashboard", permanent: false },
      { source: "/signin", destination: "/dashboard", permanent: false },
      { source: "/register", destination: "/partnership/seller", permanent: false },
      { source: "/signup", destination: "/partnership/seller", permanent: false },
      { source: "/admin", destination: "/dashboard/admin", permanent: false },
      { source: "/seller", destination: "/dashboard/seller", permanent: false },
      { source: "/artisan", destination: "/dashboard/artisan", permanent: false },
      { source: "/escrow", destination: "/dashboard/escrow", permanent: false },
      { source: "/store", destination: "/shop", permanent: false },
    ];
  },
};

export default nextConfig;
