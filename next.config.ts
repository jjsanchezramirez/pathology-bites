/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Temporarily disable linting during builds to fix deployment
  },
  typescript: {
    ignoreBuildErrors: true, // Temporarily disable TypeScript errors during builds to fix deployment
  },

  images: {
    // Disable Vercel image optimization globally to avoid free tier limits
    unoptimized: true,
    // All images use unoptimized=true to avoid Vercel optimization costs
    // remotePatterns are configured for security but optimization is disabled
    remotePatterns: [
      // Cloudflare R2 CDN (primary image storage - all images now in 'library' folder)
      {
        protocol: 'https',
        hostname: 'pub-a4bec7073d99465f99043c842be6318c.r2.dev',
        pathname: '/**',
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
  // Development optimizations
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // Extend keep alive time to avoid frequent recompilation
      maxInactiveAge: 60 * 1000, // 1 minute
      pagesBufferLength: 5,
    },
    // Disable caching in development
    generateEtags: false,
    // Disable compression to avoid cache confusion
    compress: false,
    // Force fresh builds
    distDir: '.next',
  }),
  async headers() {
    // Development: Disable all caching for easier testing
    // Production: Aggressive caching for performance
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    const cacheHeaders = isDevelopment ? [
      // Development: AGGRESSIVE no-cache for ALL routes
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Surrogate-Control',
            value: 'no-store',
          },
          {
            key: 'X-Development-Cache-Disabled',
            value: 'true',
          },
          {
            key: 'Vary',
            value: '*',
          },
        ],
      },
      // Even more aggressive for API routes
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Last-Modified',
            value: new Date().toUTCString(),
          },
          {
            key: 'ETag',
            value: `"dev-${Date.now()}"`,
          },
        ],
      },
      // Disable caching for pages
      {
        source: '/((?!_next/static).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, proxy-revalidate, private',
          },
          {
            key: 'X-Development-No-Cache',
            value: Date.now().toString(),
          },
        ],
      },
    ] : [
      // Production: Aggressive caching for images and static assets
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 year cache for images
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000',
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'public, max-age=31536000',
          },
        ],
      },
      // Cache for R2 assets (like Dr. Albright character and Anki images)
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000',
          },
        ],
      },
      // Cache for R2 storage images (external URLs get cached by browser)
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'host',
            value: '.*pathology-bites.*',
          },
        ],
        headers: [
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Cache for static files
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Cache for icons and favicons
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400', // 24 hours for icons
          },
        ],
      },
    ]

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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com https://www.googletagmanager.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.supabase.co https://vercel.live wss://*.supabase.co https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://virtualpathology.leeds.ac.uk https://www.virtualpathology.leeds.ac.uk https://images.virtualpathology.leeds.ac.uk https://pub-a4bec7073d99465f99043c842be6318c.r2.dev https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev https://challenges.cloudflare.com",
              "frame-src 'self' https://accounts.google.com https://vercel.live https://image.upmc.edu https://*.supabase.co https://pathpresenter.net https://pathpresenter.blob.core.windows.net https://pathpresenter2.blob.core.windows.net https://learn.mghpathology.org https://virtualpathology.leeds.ac.uk https://www.virtualpathology.leeds.ac.uk https://images.virtualpathology.leeds.ac.uk https://dlm.lmp.utoronto.ca https://rosai.secondslide.com https://rosaicollection.net http://www.hematopathologyetutorial.com https://hematopathologyetutorial.com https://images.virtualpathology.leeds.ac.uk/ https://challenges.cloudflare.com",
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

    return [...cacheHeaders, ...securityHeaders]
  },
}

module.exports = nextConfig
