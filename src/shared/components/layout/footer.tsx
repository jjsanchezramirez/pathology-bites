/**
 * @source src/components/layout/footer.tsx
 *
 * Component that renders the footer section of the application.
 * It includes a copyright notice and a navigation menu with links to various pages.
 * The footer is styled with Tailwind CSS classes for layout and design.
 * Mobile-optimized with responsive navigation and accessible touch targets.
 */

'use client'

import Link from "next/link"
import { MicroscopeIcon, ChevronUp } from "lucide-react"
import { useState } from "react"

export function Footer() {
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [isDesktopToolsOpen, setIsDesktopToolsOpen] = useState(false)

  // Check if we're in maintenance mode (hide tools and virtual slides)
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'

  const toggleTools = () => {
    setIsToolsOpen(!isToolsOpen)
  }

  const handleDesktopToolsEnter = () => {
    setIsDesktopToolsOpen(true)
  }

  const handleDesktopToolsLeave = () => {
    setIsDesktopToolsOpen(false)
  }

  return (
    <footer className="border-t bg-background/95">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-4">
        {/* Mobile-first layout */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-4">

          {/* Copyright section */}
          <div className="flex items-center justify-center lg:justify-start gap-2 order-2 lg:order-1">
            <MicroscopeIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-muted-foreground text-sm lg:text-xs text-center lg:text-left">
              © 2025 Pathology Bites. All rights reserved.
            </p>
          </div>

          {/* Navigation section */}
          <nav className="order-1 lg:order-2">
            {/* Mobile navigation - grid layout */}
            <div className="lg:hidden">
              <div className="grid grid-cols-2 gap-3 mb-4">
                {!isMaintenanceMode && (
                  <Link
                    href="/tools/virtual-slides"
                    className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                  >
                    Virtual Slides
                  </Link>
                )}
                <Link
                  href="/faq"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  FAQ
                </Link>
                <Link
                  href="/terms"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  Privacy
                </Link>
                <Link
                  href="/about"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  About
                </Link>
                <Link
                  href="/contact"
                  className="flex items-center justify-center py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                >
                  Contact
                </Link>
              </div>

              {/* Mobile Tools section - Hidden in maintenance mode */}
              {!isMaintenanceMode && (
                <div className="border-t pt-4">
                  <button
                    onClick={toggleTools}
                    className="flex items-center justify-center w-full py-3 px-4 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px] gap-2"
                    aria-expanded={isToolsOpen}
                    aria-controls="mobile-tools-menu"
                  >
                    Tools
                    <ChevronUp
                      className={`h-4 w-4 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isToolsOpen && (
                    <div id="mobile-tools-menu" className="mt-2 grid grid-cols-2 gap-2">
                    <Link
                      href="/tools/images"
                      className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                    >
                      Image Database
                    </Link>
                    <Link
                      href="/tools/wsi-question-generator"
                      className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                    >
                      WSI Questions (Beta)
                    </Link>
                    <Link
                      href="/tools/cell-quiz"
                      className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                    >
                      Hemepath Cell Quiz
                    </Link>
                    <Link
                      href="/tools/gene-lookup"
                      className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                    >
                      Gene Lookup
                    </Link>
                    <Link
                      href="/tools/citations"
                      className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                    >
                      Citations Generator
                    </Link>
                    <Link
                      href="/tools/lupus-anticoagulant"
                      className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                    >
                      Lupus Anticoagulant
                    </Link>
                    <Link
                      href="/tools/abpath"
                      className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                    >
                      ABPath Content
                    </Link>
                    <Link
                      href="/tools/cell-counter"
                      className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 rounded-md transition-colors min-h-[44px]"
                    >
                      Cell Counter
                    </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop navigation - horizontal layout */}
            <div className="hidden lg:flex gap-6 text-sm text-muted-foreground items-center">
              {!isMaintenanceMode && (
                <>
                  <div className="relative" onMouseEnter={handleDesktopToolsEnter} onMouseLeave={handleDesktopToolsLeave}>
                    <span className="hover:text-primary transition-colors cursor-pointer py-2 px-2 block">Tools</span>
                    <div className={`absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-background border rounded-md shadow-lg p-2 min-w-96 z-50 transition-all duration-200 ${isDesktopToolsOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                      <div className="grid grid-cols-2 gap-1">
                        <Link href="/tools/images" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm whitespace-nowrap">
                          Image Database
                        </Link>
                        <Link href="/tools/wsi-question-generator" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm whitespace-nowrap">
                          WSI Questions (Beta)
                        </Link>
                        <Link href="/tools/cell-quiz" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm whitespace-nowrap">
                          Hemepath Cell Quiz
                        </Link>
                        <Link href="/tools/gene-lookup" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm whitespace-nowrap">
                          Gene Lookup
                        </Link>
                        <Link href="/tools/citations" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm whitespace-nowrap">
                          Citations Generator
                        </Link>
                        <Link href="/tools/lupus-anticoagulant" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm whitespace-nowrap">
                          Lupus Anticoagulant
                        </Link>
                        <Link href="/tools/abpath" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm whitespace-nowrap">
                          ABPath Content
                        </Link>
                        <Link href="/tools/cell-counter" className="block px-3 py-2 text-sm hover:bg-muted rounded-sm whitespace-nowrap">
                          Cell Counter
                        </Link>
                      </div>
                    </div>
                  </div>
                  <Link href="/tools/virtual-slides" className="hover:text-primary transition-colors py-2">
                    Virtual Slides
                  </Link>
                </>
              )}
              <Link href="/faq" className="hover:text-primary transition-colors py-2">
                FAQ
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors py-2">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-primary transition-colors py-2">
                Privacy
              </Link>
              <Link href="/about" className="hover:text-primary transition-colors py-2">
                About
              </Link>
              <Link href="/contact" className="hover:text-primary transition-colors py-2">
                Contact
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </footer>
  )
}