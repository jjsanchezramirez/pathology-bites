/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false, // Enable ESLint during builds for better code quality
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || 'localhost',
        pathname: '/storage/v1/object/public/images/**',
      },
      {
        protocol: 'https',
        hostname: 'www.pathologyoutlines.com',
      },
      {
        protocol: 'https',
        hostname: 'www.captodayonline.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      enabled: true
    }
  }
}

module.exports = nextConfig
