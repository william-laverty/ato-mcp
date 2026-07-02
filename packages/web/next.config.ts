import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transpile workspace packages
  transpilePackages: ["@ato-mcp/shared"],
};

export default nextConfig;
