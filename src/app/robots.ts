// src/app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/privacy',
          '/terms',
          '/contact',
          '/categories',
          '/categories/*',
          '/questions/*',
          '/tools',
          '/tools/*',
          '/virtual-slides',
          '/virtual-slides/*',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/quiz/',
          '/profile/',
          '/settings/',
          '/auth/',
          '/signup',
          '/login',
          '/_next/',
          '/private/',
          '*.json',
          '/temp/',
          '/draft/',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
