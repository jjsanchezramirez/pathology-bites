// src/shared/hooks/use-user-role.ts
'use client'

import { useState, useEffect } from 'react'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { createClient } from '@/shared/services/client'

export type UserRole = 'admin' | 'reviewer' | 'user' | null

interface UserRoleData {
  role: UserRole
  isLoading: boolean
  error: string | null
  canAccess: (feature: string) => boolean
  isAdmin: boolean
  isReviewer: boolean
  isAdminOrReviewer: boolean
}

// Define feature permissions
const FEATURE_PERMISSIONS: Record<string, UserRole[]> = {
  'users.manage': ['admin'],
  'users.view': ['admin'],
  'questions.create': ['admin'],
  'questions.edit': ['admin'],
  'questions.delete': ['admin'],
  'questions.view': ['admin', 'reviewer'],
  'questions.review': ['admin', 'reviewer'],
  'categories.manage': ['admin'],
  'tags.manage': ['admin'],
  'sets.manage': ['admin'],
  'images.manage': ['admin'],
  'inquiries.manage': ['admin'],
  'analytics.view': ['admin'],
  'settings.manage': ['admin'],
  'dashboard.view': ['admin', 'reviewer'],
  'system.monitor': ['admin']
} as const

export function useUserRole(): UserRoleData {
  const { user, isLoading: authLoading } = useAuthStatus()
  const [role, setRole] = useState<UserRole>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUserRole() {
      if (!user) {
        setRole(null)
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // First try to get role from user metadata
        const metadataRole = user.user_metadata?.role || user.app_metadata?.role
        if (metadataRole && ['admin', 'reviewer', 'user'].includes(metadataRole)) {
          setRole(metadataRole as UserRole)
          setIsLoading(false)
          return
        }

        // Fallback to database query
        const supabase = createClient()
        const { data, error: dbError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (dbError) {
          console.error('Error fetching user role:', dbError)
          setError(dbError.message)
          setRole('user') // Default fallback
        } else {
          setRole((data?.role as UserRole) || 'user')
        }
      } catch (err) {
        console.error('Error in fetchUserRole:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setRole('user') // Default fallback
      } finally {
        setIsLoading(false)
      }
    }

    if (!authLoading) {
      fetchUserRole()
    }
  }, [user, authLoading])

  const canAccess = (feature: string): boolean => {
    if (!role) return false
    const allowedRoles = FEATURE_PERMISSIONS[feature]
    return allowedRoles ? allowedRoles.includes(role) : false
  }

  return {
    role,
    isLoading: authLoading || isLoading,
    error,
    canAccess,
    isAdmin: role === 'admin',
    isReviewer: role === 'reviewer',
    isAdminOrReviewer: role === 'admin' || role === 'reviewer'
  }
}
