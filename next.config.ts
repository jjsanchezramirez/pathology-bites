/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false, // Enable linting during builds for better code quality
  },

  images: {
    // All images use unoptimized=true to avoid Vercel optimization costs
    // remotePatterns are configured for security but optimization is disabled
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || 'htsnkuudinrcgfqlqmpi.supabase.co',
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
      // Virtual slide image hostnames
      {
        protocol: 'https',
        hostname: 'images.virtualpathology.leeds.ac.uk',
      },
      {
        protocol: 'https',
        hostname: 'ppprodpublic.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'pathpresenter.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'pathpresenter2.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'pathpresenter.net',
      },
      {
        protocol: 'https',
        hostname: 'learn.mghpathology.org',
      },
      {
        protocol: 'https',
        hostname: 'dlm.lmp.utoronto.ca',
      },
      {
        protocol: 'https',
        hostname: 'rosai.secondslide.com',
      },
      {
        protocol: 'https',
        hostname: 'hematopathologyetutorial.com',
      },
      {
        protocol: 'https',
        hostname: 'www.virtualpathology.leeds.ac.uk',
      },
      {
        protocol: 'https',
        hostname: 'rosaicollection.net',
      },
      {
        protocol: 'https',
        hostname: 'e-booktoc.s3.us-east-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'hematopathology.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      enabled: true
    }
  },
  async headers() {
    const securityHeaders = [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Enable XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer policy for privacy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy to restrict browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.supabase.co https://vercel.live wss://*.supabase.co https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://virtualpathology.leeds.ac.uk https://www.virtualpathology.leeds.ac.uk https://images.virtualpathology.leeds.ac.uk",
              "frame-src 'self' https://accounts.google.com https://vercel.live https://image.upmc.edu https://*.supabase.co https://pathpresenter.net https://pathpresenter.blob.core.windows.net https://pathpresenter2.blob.core.windows.net https://learn.mghpathology.org https://virtualpathology.leeds.ac.uk https://www.virtualpathology.leeds.ac.uk https://images.virtualpathology.leeds.ac.uk https://dlm.lmp.utoronto.ca https://rosai.secondslide.com https://rosaicollection.net http://www.hematopathologyetutorial.com https://hematopathologyetutorial.com https://images.virtualpathology.leeds.ac.uk/",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              // Only upgrade insecure requests in production
              ...(process.env.NODE_ENV === 'production' ? ["upgrade-insecure-requests"] : [])
            ].join('; '),
          },
          // Add HSTS for production, or a development-friendly header for dev
          ...(process.env.NODE_ENV === 'production' ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload',
            }
          ] : [
            {
              key: 'X-Development-Mode',
              value: 'true',
            }
          ]),
        ],
      },
    ]

    return securityHeaders
  },
}

module.exports = nextConfig
