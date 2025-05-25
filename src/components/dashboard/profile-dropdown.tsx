// src/components/dashboard/profile-dropdown.tsx
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Settings, LogOut, RefreshCw } from 'lucide-react'
import { useAuthStatus } from '@/hooks/use-auth-status'

interface UserProfile {
  id: string
  email: string | null
  role: string
  first_name: string | null
  last_name: string | null
}

export function ProfileDropdown() {
  const { user, isLoading, isAuthenticated, error, refreshAuth, isHydrated } = useAuthStatus()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const supabase = createClient()

  // Load user profile
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

  const getDisplayName = () => {
    if (!isHydrated) return 'Loading...'
    if (!user) return 'Guest'
    if (profileLoading) return 'Loading...'
    if (!userProfile) return user.email?.split('@')[0] || 'User'
    if (userProfile.first_name) {
      return `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
    }
    return user.email?.split('@')[0] || 'User'
  }

  const getInitials = () => {
    if (!isHydrated || !user) return 'G'
    if (profileLoading) return '•'
    if (!userProfile) return user.email?.[0]?.toUpperCase() || 'U'
    if (userProfile.first_name) {
      const first = userProfile.first_name[0]?.toUpperCase() || ''
      const last = userProfile.last_name?.[0]?.toUpperCase() || ''
      return first + last
    }
    return user.email?.[0]?.toUpperCase() || 'U'
  }

  // Don't render if not hydrated yet to prevent flickering
  if (!isHydrated) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <RefreshCw className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <RefreshCw className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  // Show error state with retry option
  if (error) {
    return (
      <Button variant="ghost" size="sm" onClick={() => refreshAuth()}>
        <User className="h-4 w-4" />
      </Button>
    )
  }

  // Show login button if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <a href="/login">
          <User className="h-4 w-4" />
        </a>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {getDisplayName()}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            {userProfile && (
              <p className="text-xs leading-none text-muted-foreground capitalize">
                {userProfile.role}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <a href="/dashboard">
            <User className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </a>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <a href="/dashboard/settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {(profileLoading || isLoading) && (
          <DropdownMenuItem disabled>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}