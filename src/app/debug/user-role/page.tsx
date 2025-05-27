'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStatus } from '@/hooks/use-auth-status'
import { Database } from '@/types/supabase'

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
    return <div className="p-8">Loading...</div>
  }

  if (!user) {
    return <div className="p-8">Not authenticated</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">User Role Debug Information</h1>

      <div className="space-y-6">
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Auth User Object</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">User Metadata</h2>
          <div className="space-y-2">
            <p><strong>user_metadata.role:</strong> {user.user_metadata?.role || 'Not set'}</p>
            <p><strong>app_metadata.role:</strong> {user.app_metadata?.role || 'Not set'}</p>
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Database User Record</h2>
          {error ? (
            <p className="text-red-600">Error: {error}</p>
          ) : userData ? (
            <pre className="text-sm overflow-auto">
              {JSON.stringify(userData, null, 2)}
            </pre>
          ) : (
            <p>Loading user data...</p>
          )}
        </div>

        <div className="bg-blue-100 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <div className="space-y-2">
            <button
              onClick={() => window.location.href = '/admin'}
              className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
            >
              Try Admin Access
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
