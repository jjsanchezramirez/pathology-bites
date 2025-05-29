// src/app/layout.tsx
import { ConditionalThemeProvider } from '@/components/theme/conditional-theme-provider'
import { Toaster } from "@/components/ui/toaster"
import { ConnectionStatus } from "@/components/network/connection-status"
import { cn } from '@/lib/utils'
import "@/styles/globals.css"
import { AuthProvider } from '@/components/auth/auth-provider'
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
          <div className="relative flex min-h-screen flex-col">
            <AuthProvider>
              <div>{children}</div>
            </AuthProvider>
          </div>
          <Toaster />
          <ConnectionStatus />
        </ConditionalThemeProvider>
        <Analytics/>
      </body>
    </html>
  )
}