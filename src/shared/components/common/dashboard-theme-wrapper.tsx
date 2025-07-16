// src/shared/components/common/dashboard-theme-wrapper.tsx
'use client'

import { usePathname } from 'next/navigation'
import { DashboardThemeProvider } from '@/shared/contexts/dashboard-theme-context'

interface DashboardThemeWrapperProps {
  children: React.ReactNode
}

export function DashboardThemeWrapper({ children }: DashboardThemeWrapperProps) {
  const pathname = usePathname()
  
  // Check if we're on a dashboard route
  const isDashboardRoute = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')
  
  // Only provide dashboard theme context for dashboard routes
  if (isDashboardRoute) {
    return (
      <DashboardThemeProvider>
        <div className="dashboard-theme-container">
          {children}
        </div>
      </DashboardThemeProvider>
    )
  }
  
  // For non-dashboard routes, render children without dashboard theme context
  return <>{children}</>
}
