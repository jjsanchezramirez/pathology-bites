// src/components/auth/protected-route.tsx
"use client"

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-service'
import { LoadingSpinner } from '@/components/common/loading-spinner'

interface ProtectedRouteProps {
  children: ReactNode
  adminOnly?: boolean
  redirectTo?: string
}

export function ProtectedRoute({ 
  children, 
  adminOnly = false,
  redirectTo = '/login' 
}: ProtectedRouteProps) {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()
  const { checkAuth, getUserRole } = useAuth()

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        setIsCheckingAuth(true)
        
        // Check if user is authenticated
        const authState = await checkAuth()
        
        if (!authState.isAuthenticated) {
          // Not authenticated, redirect to login
          router.push(redirectTo)
          return
        }
        
        // If this is an admin-only route, check role
        if (adminOnly) {
          const role = await getUserRole()
          
          if (role !== 'admin') {
            // Not an admin, redirect to dashboard
            router.push('/dashboard')
            return
          }
        }
        
        // User is authorized
        setIsAuthorized(true)
      } catch (error) {
        console.error('Auth verification error:', error)
        router.push(redirectTo)
      } finally {
        setIsCheckingAuth(false)
      }
    }
    
    verifyAuth()
  }, [checkAuth, getUserRole, router, adminOnly, redirectTo])

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="md" text="Verifying authentication..." />
      </div>
    )
  }
  
  if (!isAuthorized) {
    return null // The user will be redirected
  }
  
  return <>{children}</>
}