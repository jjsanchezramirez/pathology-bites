// src/features/debug/components/tools-tab.tsx
/**
 * Tools Tab - Specific feature tools and utilities
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  RefreshCw,
  MessageSquare,
  Shield,
  User,
  Play,
  TestTube,
  Database
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { createClient } from '@/shared/services/client'

export function ToolsTab() {
  const [isClearing, setIsClearing] = useState(false)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [userDataLoading, setUserDataLoading] = useState(false)
  const [userData, setUserData] = useState<any>(null)

  // User role hooks
  const { user, isLoading: authLoading } = useAuthStatus()
  const { role, isAdmin, isCreator, isReviewer, error: roleError } = useUserRole()

  const clearCache = async () => {
    setIsClearing(true)
    try {
      // Clear various caches
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }
      
      // Clear localStorage and sessionStorage
      localStorage.clear()
      sessionStorage.clear()
      
      toast.success('Cache cleared! Page will reload...')
      
      // Force reload
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Error clearing cache:', error)
      toast.error('Failed to clear cache')
    } finally {
      setIsClearing(false)
    }
  }

  const fetchUserData = async () => {
    if (!user?.id) {
      toast.error('No user logged in')
      return
    }

    setUserDataLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        toast.error(`Database error: ${error.message}`)
        setUserData({ error: error.message })
      } else {
        setUserData(data)
        toast.success('User data fetched successfully')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Error: ${errorMsg}`)
      setUserData({ error: errorMsg })
    } finally {
      setUserDataLoading(false)
    }
  }

  const tryAdminAccess = () => {
    // Open admin page in new tab to test access
    window.open('/admin', '_blank')
  }

  const generateSampleActivities = async () => {
    setActivitiesLoading(true)
    try {
      const response = await fetch('/api/debug/generate-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(`Error: ${result.error}`)
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setActivitiesLoading(false)
    }
  }



  const tools = [
    {
      category: 'System Utilities',
      tools: [
        {
          name: 'Clear Browser Cache',
          description: 'Clear all browser caches, localStorage, and force reload',
          icon: RefreshCw,
          action: clearCache,
          loading: isClearing,
          loadingText: 'Clearing...',
          variant: 'destructive' as const
        }
      ]
    },
    {
      category: 'User & Authentication',
      tools: [
        {
          name: 'Fetch User Database Data',
          description: 'Fetch current user data from database',
          icon: Database,
          action: fetchUserData,
          loading: userDataLoading,
          loadingText: 'Fetching...',
          variant: 'default' as const
        },
        {
          name: 'Try Admin Access',
          description: 'Test admin page access (opens in new tab)',
          icon: Shield,
          action: tryAdminAccess,
          loading: false,
          variant: 'outline' as const
        }
      ]
    },
    {
      category: 'Data Generation',
      tools: [
        {
          name: 'Generate Sample Activities',
          description: 'Generate sample user activities for testing dashboard',
          icon: TestTube,
          action: generateSampleActivities,
          loading: activitiesLoading,
          loadingText: 'Generating...',
          variant: 'default' as const
        }
      ]
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Tools & Utilities</h2>
        <p className="text-gray-600">Development tools and feature-specific utilities</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Tools */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Quick Tools</h3>
          
          {tools.map(category => (
            <Card key={category.category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{category.category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.tools.map(tool => (
                  <div key={tool.name} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <tool.icon className="h-5 w-5 text-gray-600" />
                        <span className="font-medium">{tool.name}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{tool.description}</p>
                    <Button
                      onClick={tool.action}
                      disabled={tool.loading}
                      variant={tool.variant}
                      size="sm"
                      className="w-full"
                    >
                      {tool.loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          {tool.loadingText}
                        </>
                      ) : (
                        <>
                          <tool.icon className="h-4 w-4 mr-2" />
                          {tool.name}
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* User Role Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">User Role Information</h3>

          {/* Authentication Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Authentication Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Auth Loading:</span>
                <span className="text-sm text-gray-600">{authLoading.toString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">User ID:</span>
                <span className="text-sm text-gray-600 font-mono">{user?.id || 'Not logged in'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm text-gray-600">{user?.email || 'Not available'}</span>
              </div>
            </CardContent>
          </Card>

          {/* User Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>User Metadata</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">user_metadata.role:</span>
                <span className="text-sm text-gray-600">{user?.user_metadata?.role || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">app_metadata.role:</span>
                <span className="text-sm text-gray-600">{user?.app_metadata?.role || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Database Role:</span>
                <span className="text-sm text-gray-600">{role || 'Loading...'}</span>
              </div>
              {roleError && (
                <div className="text-sm text-red-600">
                  <strong>Error:</strong> {roleError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Role Permissions */}
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Is Admin:</span>
                <span className={`text-sm ${isAdmin ? 'text-green-600' : 'text-gray-600'}`}>
                  {isAdmin.toString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Is Creator:</span>
                <span className={`text-sm ${isCreator ? 'text-green-600' : 'text-gray-600'}`}>
                  {isCreator.toString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Is Reviewer:</span>
                <span className={`text-sm ${isReviewer ? 'text-green-600' : 'text-gray-600'}`}>
                  {isReviewer.toString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Database User Data */}
          {userData && (
            <Card>
              <CardHeader>
                <CardTitle>Database User Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(userData, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>


    </div>
  )
}
