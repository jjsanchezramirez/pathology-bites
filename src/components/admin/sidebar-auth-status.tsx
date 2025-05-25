// src/components/admin/sidebar-auth-status.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  RefreshCw, 
  LogOut, 
  ChevronUp,
  Shield,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react'
import { useAuthStatus } from '@/hooks/use-auth-status'

interface UserProfile {
  id: string
  email: string | null
  role: string
  first_name: string | null
  last_name: string | null
}

interface SidebarAuthStatusProps {
  isCollapsed?: boolean
}

export function SidebarAuthStatus({ isCollapsed = false }: SidebarAuthStatusProps) {
  const { user, isLoading, isAuthenticated, error, refreshAuth, isHydrated } = useAuthStatus()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const supabase = createClient()

  // Load user profile when user changes
  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      if (!user || !isAuthenticated) {
        setUserProfile(null)
        return
      }

      try {
        setProfileLoading(true)

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, email, role, first_name, last_name')
          .eq('id', user.id)
          .single()

        if (!mounted) return

        if (profileError) {
          console.error('Profile error:', profileError)
          setUserProfile(null)
        } else {
          setUserProfile(profile)
        }
      } catch (err) {
        if (!mounted) return
        console.error('Profile fetch error:', err)
        setUserProfile(null)
      } finally {
        if (mounted) {
          setProfileLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [user, isAuthenticated, supabase])

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
      }
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  const getStatusIcon = () => {
    if (!isHydrated || isLoading || profileLoading) {
      return <RefreshCw className="h-4 w-4 animate-spin" />
    }
    if (error) {
      return <ShieldAlert className="h-4 w-4 text-red-400" />
    }
    if (user && userProfile?.role === 'admin') {
      return <ShieldCheck className="h-4 w-4 text-green-400" />
    }
    if (user) {
      return <Shield className="h-4 w-4 text-blue-400" />
    }
    return <ShieldAlert className="h-4 w-4 text-red-400" />
  }

  const getDisplayName = () => {
    if (!isHydrated) return 'Loading...'
    if (!user) return 'Not logged in'
    if (profileLoading) return 'Loading profile...'
    if (!userProfile) return user.email?.split('@')[0] || 'Unknown'
    if (userProfile.first_name) {
      return `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
    }
    return user.email?.split('@')[0] || 'Unknown'
  }

  const getStatusText = () => {
    if (!isHydrated) return 'Initializing...'
    if (isLoading) return 'Checking...'
    if (profileLoading) return 'Loading...'
    if (error) return 'Auth Error'
    if (user && userProfile?.role === 'admin') return 'Admin'
    if (user && userProfile) return userProfile.role
    if (user) return 'User'
    return 'Not logged in'
  }

  // Don't render until hydrated
  if (!isHydrated) {
    return (
      <div className="p-3 border-t border-slate-700/50">
        <div className="w-full h-10 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  // Collapsed view
  if (isCollapsed) {
    if (!isAuthenticated || !user) {
      return (
        <div className="p-3">
          <Button 
            size="sm" 
            variant="ghost" 
            className="w-full h-10 p-0 text-slate-300 hover:text-slate-100 hover:bg-slate-800"
            asChild
          >
            <a href="/login" title="Login Required">
              <ShieldAlert className="h-4 w-4 text-red-400" />
            </a>
          </Button>
        </div>
      )
    }

    return (
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full h-10 p-0 text-slate-300 hover:text-slate-100 hover:bg-slate-800"
              title={`${getDisplayName()} - ${getStatusText()}`}
            >
              {getStatusIcon()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-64 ml-2">
            <DropdownMenuLabel>Authentication Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <div className="px-2 py-1.5 text-sm">
              <div><strong>Status:</strong> {getStatusText()}</div>
              <div><strong>Email:</strong> {user.email}</div>
              {userProfile && (
                <div><strong>Role:</strong> {userProfile.role}</div>
              )}
            </div>
            
            {error && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-sm text-red-600">
                  <strong>Error:</strong> {error.message}
                </div>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={refreshAuth} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Status
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  // Expanded view
  if (!isAuthenticated || !user) {
    return (
      <div className="p-3 border-t border-slate-700/50">
        <Button 
          size="sm" 
          variant="ghost" 
          className="w-full justify-start text-slate-300 hover:text-slate-100 hover:bg-slate-800"
          asChild
        >
          <a href="/login">
            <ShieldAlert className="h-4 w-4 mr-3 text-red-400" />
            Login Required
          </a>
        </Button>
      </div>
    )
  }

  return (
    <div className="border-t border-slate-700/50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full h-auto p-3 justify-between text-left text-slate-300 hover:text-slate-100 hover:bg-slate-800"
          >
            <div className="flex items-center min-w-0 flex-1">
              {getStatusIcon()}
              <div className="ml-3 min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {getDisplayName()}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {getStatusText()}
                </div>
              </div>
            </div>
            <ChevronUp className="h-4 w-4 ml-2 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64 mb-2">
          <DropdownMenuLabel>Authentication Details</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <div className="px-2 py-1.5 text-sm space-y-1">
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>Status:</strong> {getStatusText()}</div>
            {userProfile && (
              <>
                <div><strong>Role:</strong> {userProfile.role}</div>
                {userProfile.first_name && (
                  <div><strong>Name:</strong> {userProfile.first_name} {userProfile.last_name}</div>
                )}
              </>
            )}
            <div className="text-xs text-muted-foreground">
              ID: {user.id.substring(0, 8)}...
            </div>
          </div>
          
          {error && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm text-red-600">
                <strong>Error:</strong> {error.message}
              </div>
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={refreshAuth} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Status
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}