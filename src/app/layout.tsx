// src/app/layout.tsx
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Toaster } from "@/components/ui/toaster"
import { cn } from '@/lib/utils'
import '@/styles/globals.css'

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
  // Create a simple server component client (we don't need to await anything here)
  const cookieStore = cookies()
  
  // We're not using the Supabase client here directly, just creating it
  // to initialize the cookie handling. The actual session check will happen 
  // in the middleware for protected routes.
  createServerComponentClient({
    cookies: () => cookieStore
  })

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <ThemeProvider attribute="class" defaultTheme="system">
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}