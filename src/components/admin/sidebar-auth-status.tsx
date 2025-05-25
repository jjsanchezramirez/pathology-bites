// src/components/admin/sidebar-auth-status.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
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
import { useCallback } from 'react';

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
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const checkAuthStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        setError(userError.message)
        setUser(null)
        setUserProfile(null)
        return
      }

      setUser(user)

      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, email, role, first_name, last_name')
          .eq('id', user.id)
          .single()

        if (profileError) {
          setError(`Profile error: ${profileError.message}`)
          setUserProfile(null)
        } else {
          setUserProfile(profile)
        }
      } else {
        setUserProfile(null)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  useEffect(() => {
    checkAuthStatus()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session ? 'session exists' : 'no session')
        await checkAuthStatus()
      }
    )

    return () => subscription.unsubscribe()
  }, [checkAuthStatus, supabase.auth])

  const getStatusIcon = () => {
    if (loading) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (error) return <ShieldAlert className="h-4 w-4 text-red-400" />
    if (user && userProfile?.role === 'admin') return <ShieldCheck className="h-4 w-4 text-green-400" />
    if (user) return <Shield className="h-4 w-4 text-yellow-400" />
    return <ShieldAlert className="h-4 w-4 text-red-400" />
  }

  const getDisplayName = () => {
    if (!user) return 'Not logged in'
    if (!userProfile) return user.email?.split('@')[0] || 'Unknown'
    if (userProfile.first_name) {
      return `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
    }
    return user.email?.split('@')[0] || 'Unknown'
  }

  const getStatusText = () => {
    if (loading) return 'Checking...'
    if (error) return 'Auth Error'
    if (user && userProfile?.role === 'admin') return 'Admin'
    if (user && userProfile) return userProfile.role
    if (user) return 'User'
    return 'Not logged in'
  }

  // Collapsed view - just icon
  if (isCollapsed) {
    if (!user) {
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
                  <strong>Error:</strong> {error}
                </div>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={checkAuthStatus} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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

  // Expanded view - full info
  if (!user) {
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
                <strong>Error:</strong> {error}
              </div>
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={checkAuthStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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