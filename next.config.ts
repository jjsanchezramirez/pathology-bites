/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'htsnkuudinrcgfqlqmpi.supabase.co',
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
