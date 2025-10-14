// src/shared/components/common/admin-mode-toggle.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Shield, User, Loader2, PenTool, Eye } from 'lucide-react'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
import { useRouter } from 'next/navigation'

export function AdminModeToggle() {
  const { isAdmin, isCreator, isReviewer } = useUserRole()
  const { adminMode, setAdminMode } = useDashboardTheme()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Only show for admin, creator, or reviewer users - ALL HOOKS MUST BE CALLED BEFORE THIS
  if (!isAdmin && !isCreator && !isReviewer) return null

  const switchToMode = async (newMode: 'admin' | 'creator' | 'reviewer' | 'user') => {
    if (newMode === adminMode) return // Already in this mode

    setIsLoading(true)

    try {
      // Update admin mode (this will also handle theme switching)
      setAdminMode(newMode)

      // Small delay to allow theme to apply
      await new Promise(resolve => setTimeout(resolve, 100))

      // Navigate to appropriate dashboard
      if (newMode === 'admin' || newMode === 'creator' || newMode === 'reviewer') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }

      // Clear loading state after navigation
      setTimeout(() => setIsLoading(false), 500)
    } catch (error) {
      console.error('Error switching mode:', error)
      setIsLoading(false)
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

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>View as:</span>
      </div>

      <div className="flex items-center bg-muted/30 rounded-md p-1 gap-1">
        {availableModes.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={adminMode === key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => switchToMode(key as any)}
            disabled={isLoading || adminMode === key}
            className="h-6 px-2 text-xs font-medium transition-all duration-200"
          >
            {isLoading && adminMode !== key ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Icon className="h-3 w-3 mr-1" />
            )}
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}