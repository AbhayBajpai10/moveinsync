// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Using webpack mode (TURBOPACK=0) because Next.js 16 Turbopack has a known
  // bug (vercel/next.js#86495) that silently breaks mapbox-gl's WebWorker,
  // causing tile fetches to never fire. Webpack correctly handles the worker.
  //
  // transpilePackages is needed for webpack to handle mapbox-gl's ESM properly.
  transpilePackages: ['mapbox-gl'],
  reactStrictMode: false,
};

export default nextConfig;