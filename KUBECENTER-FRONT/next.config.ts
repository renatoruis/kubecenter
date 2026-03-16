import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const dest = process.env.INTERNAL_API_URL || "http://localhost:3000";
    return [
      {
        source: "/api",
        destination: `${dest}/`,
      },
      {
        source: "/api/:path*",
        destination: `${dest}/:path*`,
      },
    ];
  },
};

export default nextConfig;
