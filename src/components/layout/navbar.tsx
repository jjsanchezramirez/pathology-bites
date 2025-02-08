/**
 * @source src/components/layout/navbar.tsx
 * 
 * This component renders the navigation bar for the application.
 * It includes links to the home page, login page, and signup page.
 * The navigation bar is fixed at the top of the page and has a responsive design.
 */

'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MicroscopeIcon } from "lucide-react"

export function Navbar() {
  return (
    <div className="fixed top-0 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <MicroscopeIcon className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Pathology Bites
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="hover:bg-primary/10 transition-colors">
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 transition-all duration-300">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}