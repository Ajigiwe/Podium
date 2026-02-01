import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      'firebasestorage.googleapis.com', // Firebase Storage
      'i.ytimg.com', // YouTube thumbnails
    ],
  },
  // Enable React strict mode
  reactStrictMode: true,
};

export default nextConfig;
