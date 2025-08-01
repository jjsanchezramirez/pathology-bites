// src/components/admin/sidebar-auth-status.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  RefreshCw,
  LogOut,
  ChevronUp,
  Shield,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react'
import { useSharedAuth } from '@/shared/hooks/use-shared-auth'

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
  const { user, isLoading, isAuthenticated, error } = useSharedAuth()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  const supabase = createClient()

  // Set hydrated after initial load
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Refresh auth function
  const refreshAuth = async () => {
    try {
      await supabase.auth.refreshSession()
    } catch (error) {
      console.error('Failed to refresh auth:', error)
    }
  }

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
        throw error
      }

      // Clear any local storage or cached data
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }

      // Force a hard refresh to clear all cached data and redirect to login
      window.location.href = '/login'
    } catch (err) {
      console.error('Error during sign out:', err)
      // Still redirect to login even if there's an error
      window.location.href = '/login'
    }
  }

  const getStatusIcon = () => {
    // Show spinner for ANY loading state
    if (!isHydrated || isLoading || profileLoading || (user && !userProfile)) {
      return <RefreshCw className="h-5 w-5 animate-spin" />
    }
    
    // Show appropriate icon only when everything is loaded
    if (user && userProfile?.role === 'admin') {
      return <ShieldCheck className="h-5 w-5 text-green-400" />
    }
    
    if (user && userProfile) {
      return <Shield className="h-5 w-5 text-blue-400" />
    }
    
    return <ShieldAlert className="h-5 w-5 text-red-400" />
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

  // Don't render until hydrated - FIXED: Match container structure to prevent position shift
  if (!isHydrated) {
    if (isCollapsed) {
      return (
        <div className="flex h-14 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center">
          <div className="flex items-center justify-center w-16 shrink-0">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        </div>
      )
    }
    
    return (
      <div className="flex h-14 px-2 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center w-full">
        <div className="flex items-center min-w-0 flex-1">
          <div className="flex items-center justify-center w-12 shrink-0">
            <RefreshCw className="h-5 w-5 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  // Collapsed view
  if (isCollapsed) {
    if (!isAuthenticated || !user) {
      return (
        <a
          href="/login"
          title="Login Required"
          className="flex h-14 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white"
        >
          <div className="flex items-center justify-center w-16 shrink-0">
            <ShieldAlert className="h-5 w-5 text-red-400" />
          </div>
        </a>
      )
    }

    return (
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-14 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white"
              title={`${getDisplayName()} - ${getStatusText()}`}
            >
              <div className="flex items-center justify-center w-16 shrink-0">
                {getStatusIcon()}
              </div>
            </button>
          </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-64 ml-2">
          <DropdownMenuLabel>Authentication Status</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="px-2 py-1.5 text-sm space-y-1">
            <div><strong>Name:</strong> {getDisplayName()}</div>
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>Role:</strong> {(userProfile?.role || 'User').charAt(0).toUpperCase() + (userProfile?.role || 'User').slice(1).toLowerCase()}</div>
            <div><strong>User ID:</strong> <span className="font-mono text-xs">{user.id}</span></div>
          </div>

          {error && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm text-red-600">
                <strong>Error:</strong> {String(error)}
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
      <a
        href="/login"
        className="flex h-10 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white"
      >
        <div className="flex items-center justify-center w-16 shrink-0">
          <ShieldAlert className="h-5 w-5 text-red-400" />
        </div>
        <span className="truncate">Login Required</span>
      </a>
    )
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-14 px-2 rounded-lg text-sm font-medium transition-colors duration-200 relative items-center text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white w-full justify-between">
            <div className="flex items-center min-w-0 flex-1">
              <div className="flex items-center justify-center w-12 shrink-0">
                {getStatusIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate text-left">
                  {getDisplayName()}
                </div>
                <div className="text-xs text-slate-400 truncate text-left">
                  {(userProfile?.role || 'User').charAt(0).toUpperCase() + (userProfile?.role || 'User').slice(1).toLowerCase()}
                </div>
              </div>
            </div>
            <ChevronUp className="h-4 w-4 shrink-0 ml-2" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64 mb-2">
          <DropdownMenuLabel>Authentication Details</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="px-2 py-1.5 text-sm space-y-1">
            <div><strong>Name:</strong> {getDisplayName()}</div>
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>Role:</strong> {(userProfile?.role || 'User').charAt(0).toUpperCase() + (userProfile?.role || 'User').slice(1).toLowerCase()}</div>
            <div><strong>User ID:</strong> <span className="font-mono text-xs">{user.id}</span></div>
          </div>

          {error && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-sm text-red-600">
                <strong>Error:</strong> {String(error)}
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