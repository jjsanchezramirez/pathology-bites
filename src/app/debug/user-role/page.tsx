'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/shared/services/client'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { Database } from '@/shared/types/supabase'
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { ArrowLeft, User, Shield, Database as DatabaseIcon } from "lucide-react"

type UserData = Database['public']['Tables']['users']['Row']

export default function UserRoleDebugPage() {
  const { user, isLoading } = useAuthStatus()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchUserData = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        setError(error.message)
      } else {
        setUserData(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [user?.id, supabase])

  useEffect(() => {
    if (user) {
      fetchUserData()
    }
  }, [user, fetchUserData])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center">Not authenticated</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Navigation */}
        <div className="mb-6">
          <Button variant="outline" asChild>
            <a href="/debug" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Debug Index
            </a>
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            User Role Debug Information
          </h1>
          <p className="text-gray-600">Debug user roles, permissions, and metadata</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Auth User Object
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm overflow-auto bg-gray-100 p-4 rounded">
                {JSON.stringify(user, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                User Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">user_metadata.role:</span>
                  <span className="text-gray-600">{user.user_metadata?.role || 'Not set'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">app_metadata.role:</span>
                  <span className="text-gray-600">{user.app_metadata?.role || 'Not set'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DatabaseIcon className="w-5 h-5" />
                Database User Record
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="text-red-600">Error: {error}</p>
              ) : userData ? (
                <pre className="text-sm overflow-auto bg-gray-100 p-4 rounded">
                  {JSON.stringify(userData, null, 2)}
                </pre>
              ) : (
                <p>Loading user data...</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={() => window.location.href = '/admin'}>
                  Try Admin Access
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
