import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
  // Enable React strict mode
  reactStrictMode: false,
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/index.html',
        permanent: false,
      },
      {
        source: '/login',
        destination: '/auth/login.html',
        permanent: false,
      },
      {
        source: '/register',
        destination: '/auth/register.html',
        permanent: false,
      },
      {
        source: '/auth/signup.html',
        destination: '/auth/register.html',
        permanent: false,
      },
      {
        source: '/signup',
        destination: '/auth/register.html',
        permanent: false,
      },
      {
        source: '/forgot-password',
        destination: '/auth/forgot-password.html',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/dashboard.html',
        permanent: false,
      },
      {
        source: '/history',
        destination: '/history.html',
        permanent: false,
      },
      {
        source: '/profile',
        destination: '/profile.html',
        permanent: false,
      }
    ]
  },
};

export default nextConfig;
