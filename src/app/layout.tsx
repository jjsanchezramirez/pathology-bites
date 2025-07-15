// src/app/layout.tsx
import { ConditionalThemeProvider } from '@/shared/components/common/conditional-theme-provider'
import { FontSizeProvider } from '@/shared/contexts/font-size-context'
import { Toaster as SonnerToaster } from "@/shared/components/ui/sonner"
import { ConnectionStatus } from "@/shared/components/common/connection-status"
import { cn } from '@/shared/utils'
import "@/styles/globals.css"
import { AuthProvider } from '@/features/auth/components/auth-provider'
import { Analytics } from "@vercel/analytics/next"

export const metadata = {
  title: 'Pathology Bites',
  description: 'Master Pathology with bite-sized learning',
  icons: {
    icon: [
      { url: '/icons/microscope.svg', type: 'image/svg+xml' },
    ]
  }
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
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <ConditionalThemeProvider attribute="class" defaultTheme="light">
          <FontSizeProvider>
            <div className="relative flex min-h-screen flex-col">
              <AuthProvider>
                <div>{children}</div>
              </AuthProvider>
            </div>
            <SonnerToaster />
            <ConnectionStatus />
          </FontSizeProvider>
        </ConditionalThemeProvider>
        <Analytics/>
      </body>
    </html>
  )
}