import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['promptfoo', '@esbuild/darwin-arm64'],
};

export default nextConfig;
