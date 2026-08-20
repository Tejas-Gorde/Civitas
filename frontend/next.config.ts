import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const backendTarget =
      process.env.NODE_ENV === "production" || process.env.RENDER
        ? "https://civitas-backend-adjg.onrender.com/api/v1/:path*"
        : "http://localhost:8000/api/v1/:path*";

    return [
      {
        source: "/api/v1/:path*",
        destination: backendTarget,
      },
    ];
  },
};

export default nextConfig;
