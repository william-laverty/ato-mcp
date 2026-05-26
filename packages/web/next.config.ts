import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transpile workspace packages
  transpilePackages: ["@ato-pro/shared"],
};

export default nextConfig;
