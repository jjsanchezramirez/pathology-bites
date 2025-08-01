// src/components/layout/navbar.tsx
'use client'

import { Button } from "@/shared/components/ui/button"
import Link from "next/link"
import { MicroscopeIcon } from "lucide-react"

export function Navbar() {
  // Check if coming soon or maintenance mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isAdminOnlyMode = isComingSoonMode || isMaintenanceMode

  return (
    <div className="fixed top-0 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <MicroscopeIcon className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Pathology Bites
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="hover:bg-primary/10 transition-colors">
              {isAdminOnlyMode ? 'Admin Login' : 'Login'}
            </Button>
          </Link>
          {!isAdminOnlyMode && (
            <Link href="/signup">
              <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 transition-all duration-300">
                Sign up
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}