/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'htsnkuudinrcgfqlqmpi.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'www.pathologyoutlines.com',
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
