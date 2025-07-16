// src/features/dashboard/components/dashboard-layout-client.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardSidebar } from './dashboard-sidebar'
import { DashboardHeader } from './dashboard-header'
import { useQuizMode } from '@/shared/hooks/use-quiz-mode'
import { useMobile } from '@/shared/hooks/use-mobile'

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { isInQuizMode } = useQuizMode()
  const isMobile = useMobile()

  // Sidebar state management
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [preQuizState, setPreQuizState] = useState(false) // Store state before entering quiz mode

  // Track previous quiz mode state to detect transitions
  const prevQuizModeRef = useRef(isInQuizMode)

  // Determine actual sidebar state - mobile always collapsed, otherwise use state
  const isSidebarCollapsed = isMobile || isCollapsed

  // Handle quiz mode transitions
  useEffect(() => {
    const wasInQuizMode = prevQuizModeRef.current
    const isNowInQuizMode = isInQuizMode

    if (!wasInQuizMode && isNowInQuizMode && !isMobile) {
      // Entering quiz mode on desktop - save current state and auto-collapse
      setPreQuizState(isCollapsed)
      setIsCollapsed(true)
    } else if (wasInQuizMode && !isNowInQuizMode && !isMobile) {
      // Exiting quiz mode on desktop - restore previous state
      setIsCollapsed(preQuizState)
    }

    prevQuizModeRef.current = isInQuizMode
  }, [isInQuizMode, isCollapsed, preQuizState, isMobile])

  // Handle mobile state changes - always collapse on mobile
  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true)
    }
  }, [isMobile])

  // Handle manual toggle - works in all modes except mobile (mobile always collapsed)
  const handleToggleSidebar = () => {
    if (!isMobile) {
      setIsCollapsed(!isCollapsed)
    }
    // On mobile, do nothing - sidebar stays collapsed
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Fixed Sidebar */}
      <DashboardSidebar isCollapsed={isSidebarCollapsed} />

      {/* Main Content Area */}
      <div
        className={`fixed top-0 right-0 bottom-0 flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'left-16' : 'left-64'
        }`}
      >
        {/* Fixed Header */}
        <DashboardHeader onToggleSidebar={handleToggleSidebar} />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto bg-background">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] pointer-events-none" />

          {/* Content */}
          <div className="relative p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
