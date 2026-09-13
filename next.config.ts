import path from "path";
import type { NextConfig } from "next";

const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
  allowedDevOrigins: extraOrigins,
};

export default nextConfig;
