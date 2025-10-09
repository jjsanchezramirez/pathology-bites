// src/shared/components/common/admin-mode-toggle.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Shield, User, Loader2 } from 'lucide-react'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
import { useRouter } from 'next/navigation'

export function AdminModeToggle() {
  const { isAdmin } = useUserRole()
  const { adminMode, setAdminMode } = useDashboardTheme()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Only show for admin users - ALL HOOKS MUST BE CALLED BEFORE THIS
  if (!isAdmin) return null

  const toggleMode = async () => {
    setIsLoading(true)
    const newMode = adminMode === 'admin' ? 'user' : 'admin'

    // Update admin mode (this will also handle theme switching)
    setAdminMode(newMode)

    // Small delay to allow theme to apply
    await new Promise(resolve => setTimeout(resolve, 100))

    // Navigate to appropriate dashboard
    if (newMode === 'admin') {
      router.push('/admin/dashboard')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>View as:</span>
      </div>

      <div className="flex items-center bg-muted/30 rounded-md p-1 gap-1">
        <Button
          variant={adminMode === 'admin' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => adminMode !== 'admin' && toggleMode()}
          disabled={isLoading || adminMode === 'admin'}
          className="h-6 px-2 text-xs font-medium transition-all duration-200"
        >
          {isLoading && adminMode === 'user' ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Shield className="h-3 w-3 mr-1" />
          )}
          Admin
        </Button>

        <Button
          variant={adminMode === 'user' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => adminMode !== 'user' && toggleMode()}
          disabled={isLoading || adminMode === 'user'}
          className="h-6 px-2 text-xs font-medium transition-all duration-200"
        >
          {isLoading && adminMode === 'admin' ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <User className="h-3 w-3 mr-1" />
          )}
          Student
        </Button>
      </div>
    </div>
  )
}