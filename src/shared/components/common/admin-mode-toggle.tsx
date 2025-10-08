// src/shared/components/common/admin-mode-toggle.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Shield, User, RotateCcw } from 'lucide-react'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
import { useRouter } from 'next/navigation'

export function AdminModeToggle() {
  const { isAdmin } = useUserRole()
  const { adminMode, setAdminMode } = useDashboardTheme()
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Only show for admin users - moved after all hooks
  if (!isAdmin) return null

  const toggleMode = async () => {
    setIsLoading(true)
    const newMode = adminMode === 'admin' ? 'user' : 'admin'
    
    // Update admin mode (this will also handle theme switching)
    setAdminMode(newMode)
    
    // Navigate to appropriate dashboard
    if (newMode === 'admin') {
      router.push('/admin/dashboard')
    } else {
      router.push('/dashboard')
    }
    
    // Small delay to show loading state
    setTimeout(() => setIsLoading(false), 500)
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
          className="h-6 px-2 text-xs font-medium"
        >
          <Shield className="h-3 w-3 mr-1" />
          Admin
        </Button>
        
        <Button
          variant={adminMode === 'user' ? 'default' : 'ghost'}
          size="sm" 
          onClick={() => adminMode !== 'user' && toggleMode()}
          disabled={isLoading || adminMode === 'user'}
          className="h-6 px-2 text-xs font-medium"
        >
          <User className="h-3 w-3 mr-1" />
          Student
        </Button>
      </div>
      
      {isLoading && (
        <RotateCcw className="h-3 w-3 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}