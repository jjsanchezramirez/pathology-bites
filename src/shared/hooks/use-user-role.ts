// src/shared/hooks/use-user-role.ts
'use client'

import { useState, useEffect } from 'react'
import { useSharedAuth } from '@/shared/hooks/use-shared-auth'
import { createClient } from '@/shared/services/client'

export type UserRole = 'admin' | 'creator' | 'reviewer' | 'user' | null

interface UserRoleData {
  role: UserRole
  isLoading: boolean
  error: string | null
  canAccess: (feature: string) => boolean
  isAdmin: boolean
  isCreator: boolean
  isReviewer: boolean
  isAdminOrReviewer: boolean
  isCreatorOrAbove: boolean
}

// Define feature permissions based on 4-role system
const FEATURE_PERMISSIONS: Record<string, UserRole[]> = {
  // Admin-only permissions
  'users.manage': ['admin'],
  'users.view': ['admin'],
  'categories.manage': ['admin'],
  'tags.manage': ['admin'],
  'sets.manage': ['admin'],
  'images.manage': ['admin'],
  'inquiries.manage': ['admin'],
  'analytics.view': ['admin'],
  'settings.manage': ['admin'],
  'system.monitor': ['admin'],

  // Creator permissions - can create and manage content
  'questions.create': ['admin', 'creator'],
  'questions.edit.own': ['admin', 'creator'], // Can edit own draft questions
  'questions.submit': ['admin', 'creator'], // Can submit for review

  // Reviewer permissions - can review and approve
  'questions.review': ['admin', 'reviewer'],
  'questions.approve': ['admin', 'reviewer'],
  'questions.reject': ['admin', 'reviewer'],

  // Admin can edit any question directly
  'questions.edit': ['admin'],
  'questions.delete': ['admin'],

  // Shared permissions
  'questions.view': ['admin', 'creator', 'reviewer'],
  'dashboard.view': ['admin', 'creator', 'reviewer'],
  'questions.flag': ['admin', 'creator', 'reviewer', 'user'] // Users can flag questions
} as const

export function useUserRole(): UserRoleData {
  const { user, isLoading: authLoading } = useSharedAuth()
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
        if (metadataRole && ['admin', 'creator', 'reviewer', 'user'].includes(metadataRole)) {
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
          .maybeSingle() // Use maybeSingle instead of single to handle no results gracefully

        if (dbError) {
          setError(dbError.message)
          setRole('user') // Default fallback
        } else if (data) {
          setRole((data.role as UserRole) || 'user')
        } else {
          // User not found in database - this shouldn't happen normally
          // Default to 'user' role
          setRole('user')
        }
      } catch (err) {
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
    isCreator: role === 'creator',
    isReviewer: role === 'reviewer',
    isAdminOrReviewer: role === 'admin' || role === 'reviewer',
    isCreatorOrAbove: role === 'admin' || role === 'creator' || role === 'reviewer'
  }
}
