import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Compress responses
  compress: true,
  // Reduce JS bundle size
  productionBrowserSourceMaps: false,
  // Power performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@simplewebauthn/browser'],
  },
};

export default nextConfig;
