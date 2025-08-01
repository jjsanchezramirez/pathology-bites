// src/shared/components/layout/unified-layout-client.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useMobile } from '@/shared/hooks/use-mobile'
import { useQuizMode } from '@/shared/hooks/use-quiz-mode'
import { UnifiedSidebar } from './unified-sidebar'
import { UnifiedHeader, HeaderConfig } from './unified-header'
import { NavigationItem, getNavigationConfig } from '@/shared/config/navigation'
import { useUserRole } from '@/shared/hooks/use-user-role'

interface UnifiedLayoutClientProps {
  children: React.ReactNode
  userType: 'admin' | 'user'
  headerConfig?: HeaderConfig
}

// Simplified sidebar state enum
type SidebarState = 'hidden' | 'collapsed' | 'expanded'

export function UnifiedLayoutClient({
  children,
  userType,
  headerConfig
}: UnifiedLayoutClientProps) {
  const { role } = useUserRole()

  // Get navigation items based on user type and role
  const navigationConfig = getNavigationConfig(
    userType === 'admin' ? (role || 'user') : 'user'
  )
  const navigationItems = navigationConfig.items
  const { isInQuizMode } = useQuizMode()
  const isMobile = useMobile()

  // Simplified state management - separate desktop and mobile states
  const [desktopCollapsed, setDesktopCollapsed] = useState(false) // Desktop: false = expanded, true = collapsed
  const [mobileVisible, setMobileVisible] = useState(false) // Mobile: false = hidden, true = visible
  const [preQuizDesktopState, setPreQuizDesktopState] = useState(false) // Store desktop state before quiz mode
  const [isHydrated, setIsHydrated] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Handle quiz mode changes on desktop only
  useEffect(() => {
    if (!isMobile && isHydrated) {
      if (isInQuizMode) {
        // Entering quiz mode: save current state and collapse
        setPreQuizDesktopState(desktopCollapsed)
        setDesktopCollapsed(true)
      } else {
        // Exiting quiz mode: restore previous state
        setDesktopCollapsed(preQuizDesktopState)
      }
    }
  }, [isInQuizMode, isMobile, isHydrated])

  // Handle click outside to close mobile sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMobile &&
        mobileVisible &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setMobileVisible(false)
      }
    }

    if (isMobile && mobileVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMobile, mobileVisible])

  // Handle navigation link clicks on mobile (auto-hide sidebar)
  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const link = target.closest('a')
      if (link && isMobile && mobileVisible) {
        // Small delay to allow navigation to start
        setTimeout(() => setMobileVisible(false), 100)
      }
    }

    if (isMobile && mobileVisible) {
      document.addEventListener('click', handleLinkClick)
      return () => document.removeEventListener('click', handleLinkClick)
    }
  }, [isMobile, mobileVisible])

  // Handle sidebar toggle
  const handleToggleSidebar = () => {
    if (isMobile) {
      // On mobile: toggle visibility
      setMobileVisible(!mobileVisible)
    } else {
      // On desktop: toggle between collapsed and expanded (only if not in quiz mode)
      if (!isInQuizMode) {
        setDesktopCollapsed(!desktopCollapsed)
      }
    }
  }

  // Determine final sidebar properties
  const sidebarHidden = isMobile ? !mobileVisible : false // Desktop always visible
  const sidebarCollapsed = isMobile ? false : desktopCollapsed // Mobile always expanded when visible

  // Don't render until hydrated to prevent layout shift
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden bg-background"
      style={{
        height: '100dvh', // Use dynamic viewport height for mobile browsers
        minHeight: '100vh', // Fallback for browsers that don't support dvh
      }}
    >
      {/* Mobile Backdrop - subtle dark tint */}
      {isMobile && mobileVisible && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-all duration-300"
          onClick={() => setMobileVisible(false)}
        />
      )}

      {/* Sidebar - different approach for desktop vs mobile */}
      {isMobile ? (
        // Mobile: Always render but use transforms for animation
        <div
          ref={sidebarRef}
          className={`fixed left-0 top-0 z-50 transform transition-transform duration-300 ease-in-out ${
            mobileVisible ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <UnifiedSidebar
            isCollapsed={sidebarCollapsed}
            navigationItems={navigationItems}
            isMobileMode={true}
          />
        </div>
      ) : (
        // Desktop: Always render, no transforms needed
        <div ref={sidebarRef}>
          <UnifiedSidebar
            isCollapsed={sidebarCollapsed}
            navigationItems={navigationItems}
            isMobileMode={false}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`fixed top-0 right-0 flex flex-col transition-all duration-300 ${
          isMobile
            ? 'left-0' // Mobile: always full width, sidebar overlays
            : desktopCollapsed
              ? 'left-16' // Desktop collapsed: 64px
              : 'left-64' // Desktop expanded: 256px
        }`}
        style={{
          height: '100dvh', // Use dynamic viewport height for mobile browsers
          minHeight: '100vh', // Fallback for browsers that don't support dvh
        }}
      >
        {/* Header */}
        <UnifiedHeader
          onToggleSidebar={handleToggleSidebar}
          config={headerConfig}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto max-w-7xl p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
