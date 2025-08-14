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
import { cacheService } from '@/shared/services/cache-service'

export function ToolsTab() {
  const [isClearing, setIsClearing] = useState(false)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [userDataLoading, setUserDataLoading] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [cacheResults, setCacheResults] = useState<Array<{type: string, success: boolean, error?: string}>>([])

  // User role hooks
  const { user, isLoading: authLoading } = useAuthStatus()
  const { role, isAdmin, isCreator, isReviewer, error: roleError } = useUserRole()

  const clearCache = async () => {
    setIsClearing(true)
    const results: Array<{type: string, success: boolean, error?: string}> = []
    
    // Helper to track results
    const trackResult = (type: string, success: boolean, error?: string) => {
      results.push({ type, success, error })
      setCacheResults([...results])
    }

    try {
      // 1. Clear Service Worker caches
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          if (cacheNames.length > 0) {
            await Promise.all(cacheNames.map(name => caches.delete(name)))
            trackResult(`Service Worker Caches (${cacheNames.length})`, true)
          } else {
            trackResult('Service Worker Caches', true, 'No caches found')
          }
        } else {
          trackResult('Service Worker Caches', false, 'Not supported')
        }
      } catch (error) {
        trackResult('Service Worker Caches', false, error instanceof Error ? error.message : 'Unknown error')
      }

      // 2. Clear localStorage
      try {
        const localStorageKeys = Object.keys(localStorage)
        localStorage.clear()
        trackResult(`localStorage (${localStorageKeys.length} items)`, true)
      } catch (error) {
        trackResult('localStorage', false, error instanceof Error ? error.message : 'Unknown error')
      }

      // 3. Clear sessionStorage
      try {
        const sessionStorageKeys = Object.keys(sessionStorage)
        sessionStorage.clear()
        trackResult(`sessionStorage (${sessionStorageKeys.length} items)`, true)
      } catch (error) {
        trackResult('sessionStorage', false, error instanceof Error ? error.message : 'Unknown error')
      }

      // 4. Clear application cache service
      try {
        const stats = cacheService.getStats()
        cacheService.clear()
        trackResult(`Application Cache Service (${stats.memoryEntries} entries)`, true)
      } catch (error) {
        trackResult('Application Cache Service', false, error instanceof Error ? error.message : 'Unknown error')
      }

      // 5. Clear IndexedDB (if any exists)
      try {
        if ('indexedDB' in window) {
          const databases = await indexedDB.databases?.()
          if (databases && databases.length > 0) {
            await Promise.all(databases.map(db => {
              if (db.name) {
                return new Promise<void>((resolve, reject) => {
                  const deleteReq = indexedDB.deleteDatabase(db.name!)
                  deleteReq.onsuccess = () => resolve()
                  deleteReq.onerror = () => reject(deleteReq.error)
                })
              }
            }))
            trackResult(`IndexedDB (${databases.length} databases)`, true)
          } else {
            trackResult('IndexedDB', true, 'No databases found')
          }
        } else {
          trackResult('IndexedDB', false, 'Not supported')
        }
      } catch (error) {
        trackResult('IndexedDB', false, error instanceof Error ? error.message : 'Unknown error')
      }

      // 6. Clear cookies (document.cookie - limited to same-origin)
      try {
        const cookies = document.cookie.split(';')
        let cookieCount = 0
        cookies.forEach(cookie => {
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`
            cookieCount++
          }
        })
        trackResult(`Document Cookies (${cookieCount} cleared)`, true)
      } catch (error) {
        trackResult('Document Cookies', false, error instanceof Error ? error.message : 'Unknown error')
      }

      // 7. Clear performance entries
      try {
        if ('performance' in window && window.performance.clearResourceTimings) {
          const resourceCount = window.performance.getEntriesByType('resource').length
          window.performance.clearResourceTimings()
          window.performance.clearMarks?.()
          window.performance.clearMeasures?.()
          trackResult(`Performance Entries (${resourceCount} resources)`, true)
        } else {
          trackResult('Performance Entries', false, 'Not supported')
        }
      } catch (error) {
        trackResult('Performance Entries', false, error instanceof Error ? error.message : 'Unknown error')
      }

      // Summary
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      
      if (failed === 0) {
        toast.success(`All ${successful} cache types cleared successfully! Page will reload...`)
        setTimeout(() => window.location.reload(), 2000)
      } else if (successful > 0) {
        toast.success(`${successful} cache types cleared, ${failed} failed. Check details below. Page will reload...`)
        setTimeout(() => window.location.reload(), 3000)
      } else {
        toast.error(`Failed to clear all cache types. Check details below.`)
      }
      
    } catch (error) {
      toast.error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
          name: 'Clear All Caches',
          description: 'Comprehensive cache clearing: Service Worker, localStorage, sessionStorage, IndexedDB, cookies, performance entries, and application cache',
          icon: RefreshCw,
          action: clearCache,
          loading: isClearing,
          loadingText: 'Clearing caches...',
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

          {/* Cache Clear Results */}
          {cacheResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <RefreshCw className="h-5 w-5" />
                  <span>Cache Clear Results</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cacheResults.map((result, index) => (
                  <div key={index} className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                    result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        result.success ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium">{result.type}</span>
                    </div>
                    <div className={`text-xs ${
                      result.success ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.success ? 'Cleared' : result.error || 'Failed'}
                    </div>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCacheResults([])}
                    className="w-full"
                  >
                    Clear Results
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
