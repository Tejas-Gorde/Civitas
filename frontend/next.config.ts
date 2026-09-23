import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const rawBackend =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production" || process.env.RENDER
        ? "https://civitas-backend-adjg.onrender.com/api/v1"
        : "http://localhost:8000/api/v1");

    const cleanBackend = rawBackend.trim().replace(/\/+$/, "").replace(/\/api\/v1$/, "");
    const backendTarget = `${cleanBackend}/api/v1/:path*`;

    return [
      {
        source: "/api/v1/:path*",
        destination: backendTarget,
      },
    ];
  },
};

export default nextConfig;
