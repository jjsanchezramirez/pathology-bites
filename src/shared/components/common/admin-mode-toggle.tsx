// src/shared/components/common/admin-mode-toggle.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Shield, User, Loader2, PenTool, Eye } from 'lucide-react'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
import { useRouter } from 'next/navigation'

export function AdminModeToggle() {
  const { isAdmin, isCreator, isReviewer } = useUserRole()
  const { adminMode, setAdminMode, isTransitioning, setTransitioning } = useDashboardTheme()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Only show for admin, creator, or reviewer users - ALL HOOKS MUST BE CALLED BEFORE THIS
  if (!isAdmin && !isCreator && !isReviewer) return null

  const switchToMode = async (newMode: 'admin' | 'creator' | 'reviewer' | 'user') => {
    if (newMode === adminMode) return // Already in this mode

    try {
      // Start global transition state immediately
      setTransitioning(true)
      setIsLoading(true)

      // Small delay to ensure skeleton states are visible before theme changes
      await new Promise(resolve => setTimeout(resolve, 150))

      // Update admin mode (this will also handle theme switching)
      setAdminMode(newMode)

      // Small delay to allow theme to apply
      await new Promise(resolve => setTimeout(resolve, 200))

      // Navigate to appropriate dashboard
      if (newMode === 'admin' || newMode === 'creator' || newMode === 'reviewer') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }

      // Clear loading states after navigation with longer delay for content to load
      setTimeout(() => {
        setIsLoading(false)
        setTransitioning(false)
      }, 800)
    } catch (error) {
      console.error('Error switching mode:', error)
      setIsLoading(false)
      setTransitioning(false)
    }
  }

  // Get available modes based on user role
  const getAvailableModes = () => {
    const modes = []

    if (isAdmin) {
      modes.push({ key: 'admin', label: 'Admin', icon: Shield })
    }
    if (isAdmin || isCreator) {
      modes.push({ key: 'creator', label: 'Creator', icon: PenTool })
    }
    if (isAdmin || isReviewer) {
      modes.push({ key: 'reviewer', label: 'Reviewer', icon: Eye })
    }

    // Everyone can view as student
    modes.push({ key: 'user', label: 'Student', icon: User })

    return modes
  }

  const availableModes = getAvailableModes()

  // Show skeleton loading state while switching modes
  if (isLoading || isTransitioning) {
    return (
      <div className="flex items-center bg-muted/20 rounded-lg p-1 gap-0.5">
        {Array.from({ length: availableModes.length }).map((_, index) => (
          <div key={index} className="flex items-center h-7 px-3 gap-1.5">
            <Skeleton className="h-3 w-3 rounded-sm" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center bg-muted/20 rounded-lg p-1 gap-0.5">
      {availableModes.map(({ key, label, icon: Icon }) => (
        <Button
          key={key}
          variant={adminMode === key ? 'default' : 'ghost'}
          size="sm"
          onClick={() => switchToMode(key as any)}
          disabled={isLoading || isTransitioning}
          className={`
            h-7 px-3 text-xs font-medium transition-all duration-200 
            ${adminMode === key 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }
          `}
        >
          <Icon className="h-3 w-3 mr-1.5" />
          {label}
        </Button>
      ))}
    </div>
  )
}