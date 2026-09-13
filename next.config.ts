import path from "path";
import type { NextConfig } from "next";

const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  basePath: "/toefl",
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
  allowedDevOrigins: extraOrigins,
  async redirects() {
    return [
      { source: "/", destination: "/toefl", basePath: false, permanent: false },
      { source: "/login", destination: "/toefl/login", basePath: false, permanent: false },
    ];
  },
};

export default nextConfig;
