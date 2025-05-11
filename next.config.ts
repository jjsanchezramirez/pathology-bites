/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next.js 15 no longer needs swcMinify option, it's removed
};

// Use CommonJS syntax for Node.js compatibility
module.exports = nextConfig;