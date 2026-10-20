import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The codebase still has many `any`s; run `npm run lint` separately instead of failing builds on it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
