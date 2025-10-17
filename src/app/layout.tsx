// src/app/layout.tsx
import { ConditionalThemeProvider } from '@/shared/components/common/conditional-theme-provider'
import { Toaster as SonnerToaster } from "@/shared/components/ui/sonner"
import { ConnectionStatus } from "@/shared/components/common/connection-status"
import { CookieConsentBanner } from "@/shared/components/common/cookie-consent-banner"

import { cn } from '@/shared/utils'
import "@/styles/globals.css"
import { AuthProvider } from '@/features/auth/components/auth-provider'
import { AnalyticsProvider } from '@/shared/components/analytics/analytics-provider'
import { OrganizationSchema, WebsiteSchema } from '@/shared/components/seo/structured-data'

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com'),
  title: {
    default: 'Pathology Bites - Free Pathology Education & Practice Questions',
    template: '%s | Pathology Bites'
  },
  description: 'Master pathology with free practice questions, detailed explanations, and comprehensive study materials. Perfect for medical students, residents, and pathology professionals.',
  keywords: [
    'pathology',
    'medical education',
    'practice questions',
    'pathology quiz',
    'medical students',
    'pathology residents',
    'anatomic pathology',
    'clinical pathology',
    'histopathology',
    'cytopathology',
    'medical learning',
    'pathology board exam',
    'pathology review',
    'medical quiz',
    'pathology cases'
  ],
  authors: [{ name: 'Pathology Bites Team' }],
  creator: 'Pathology Bites',
  publisher: 'Pathology Bites',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Pathology Bites',
    title: 'Pathology Bites - Free Pathology Education & Practice Questions',
    description: 'Master pathology with free practice questions, detailed explanations, and comprehensive study materials. Perfect for medical students, residents, and pathology professionals.',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Pathology Bites - Free Pathology Education',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pathology Bites - Free Pathology Education & Practice Questions',
    description: 'Master pathology with free practice questions, detailed explanations, and comprehensive study materials.',
    images: ['/images/twitter-image.png'],
    creator: '@pathologybites',
    site: '@pathologybites',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'android-chrome', url: '/icons/android-chrome-192x192.png', sizes: '192x192' },
      { rel: 'android-chrome', url: '/icons/android-chrome-512x512.png', sizes: '512x512' },
    ],
  },
  manifest: '/manifest.json',
  category: 'education',
  classification: 'Medical Education',
  other: {
    'google-site-verification': process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Don't try to initialize Supabase here at all since middleware handles auth
  // Just render the layout
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* DNS Prefetch for performance */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
        <link rel="dns-prefetch" href="//www.google-analytics.com" />

        {/* Preconnect for critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Font loading with display=swap for better performance */}
        <link
          href="https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap"
          rel="stylesheet"
        />

        {/* Theme color for mobile browsers - matches app background */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <meta name="msapplication-TileColor" content="#ffffff" />

        {/* Viewport meta tag for responsive design */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        {/* Structured Data */}
        <OrganizationSchema />
        <WebsiteSchema
          potentialAction={{
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pathologybites.com'}/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          }}
        />

        <AnalyticsProvider>
          <ConditionalThemeProvider attribute="class" defaultTheme="system">
            <div className="relative flex min-h-screen flex-col">
              <AuthProvider>
                <div>{children}</div>
              </AuthProvider>
            </div>
            <SonnerToaster />
            <ConnectionStatus />
            <CookieConsentBanner />
            {/* Cache clear button temporarily removed due to SSR error */}
          </ConditionalThemeProvider>
        </AnalyticsProvider>
      </body>
    </html>
  )
}