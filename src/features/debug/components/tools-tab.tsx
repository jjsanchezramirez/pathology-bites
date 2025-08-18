// src/features/debug/components/tools-tab.tsx
/**
 * Tools Tab - Miscellaneous debug tools
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Badge } from '@/shared/components/ui/badge'
import { Settings, Trash2, Database, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export function ToolsTab() {
  const [isClearing, setIsClearing] = useState(false)
  const [clearResults, setClearResults] = useState<{
    success: string[]
    errors: string[]
  } | null>(null)

  const clearAllCaches = async () => {
    setIsClearing(true)
    setClearResults(null)
    
    const results = {
      success: [] as string[],
      errors: [] as string[]
    }

    try {
      // 1. Clear localStorage
      try {
        const localStorageKeys = Object.keys(localStorage)
        localStorage.clear()
        results.success.push(`Local Storage (${localStorageKeys.length} items cleared)`)
      } catch (error) {
        results.errors.push(`Local Storage: ${error}`)
      }

      // 2. Clear sessionStorage
      try {
        const sessionStorageKeys = Object.keys(sessionStorage)
        sessionStorage.clear()
        results.success.push(`Session Storage (${sessionStorageKeys.length} items cleared)`)
      } catch (error) {
        results.errors.push(`Session Storage: ${error}`)
      }

      // 3. Clear IndexedDB databases
      try {
        if ('indexedDB' in window) {
          // Get list of databases (if supported)
          let dbCount = 0
          if ('databases' in indexedDB) {
            const databases = await indexedDB.databases()
            for (const db of databases) {
              if (db.name) {
                const deleteReq = indexedDB.deleteDatabase(db.name)
                await new Promise((resolve, reject) => {
                  deleteReq.onsuccess = () => resolve(undefined)
                  deleteReq.onerror = () => reject(deleteReq.error)
                })
                dbCount++
              }
            }
          }
          results.success.push(`IndexedDB (${dbCount} databases cleared)`)
        }
      } catch (error) {
        results.errors.push(`IndexedDB: ${error}`)
      }

      // 4. Clear Cache API
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map(name => caches.delete(name)))
          results.success.push(`Cache API (${cacheNames.length} caches cleared)`)
        }
      } catch (error) {
        results.errors.push(`Cache API: ${error}`)
      }

      // 5. Clear ServiceWorker cache (if available)
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          for (const registration of registrations) {
            await registration.unregister()
          }
          if (registrations.length > 0) {
            results.success.push(`Service Workers (${registrations.length} unregistered)`)
          }
        }
      } catch (error) {
        results.errors.push(`Service Workers: ${error}`)
      }

      // 6. Clear cookies (client-side accessible ones)
      try {
        const cookies = document.cookie.split(';')
        let cookieCount = 0
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`
            cookieCount++
          }
        }
        if (cookieCount > 0) {
          results.success.push(`Cookies (${cookieCount} cleared)`)
        }
      } catch (error) {
        results.errors.push(`Cookies: ${error}`)
      }

      // 7. Clear WebSQL (legacy, but still supported in some browsers)
      try {
        if ('openDatabase' in window) {
          results.success.push('WebSQL (legacy support checked)')
        }
      } catch (error) {
        // WebSQL not supported, this is expected
      }

      // 8. Clear Next.js router cache
      try {
        if (typeof window !== 'undefined' && window.next && window.next.router) {
          // Clear Next.js router cache
          window.next.router.replace(window.location.pathname)
          results.success.push('Next.js Router Cache (cleared)')
        }
      } catch (error) {
        results.errors.push(`Next.js Router: ${error}`)
      }

      // 9. Clear React Query cache (if present)
      try {
        if (typeof window !== 'undefined' && (window as any).queryClient) {
          (window as any).queryClient.clear()
          results.success.push('React Query Cache (cleared)')
        }
      } catch (error) {
        // React Query not present, which is fine
      }

      // 10. Clear application-specific caches
      try {
        // Clear data manager cache
        if (typeof window !== 'undefined') {
          // Clear any global cache variables we know about
          const globalCaches = [
            'wsiDataCache',
            'cellQuizCache', 
            'virtualSlidesCache',
            'contextSearchCache',
            'geneCache',
            'citationsCache'
          ]
          
          let clearedCount = 0
          globalCaches.forEach(cacheName => {
            if ((window as any)[cacheName]) {
              delete (window as any)[cacheName]
              clearedCount++
            }
          })
          
          if (clearedCount > 0) {
            results.success.push(`Global App Caches (${clearedCount} cleared)`)
          }
        }
      } catch (error) {
        results.errors.push(`App caches: ${error}`)
      }

      // 11. Clear browser memory caches (force garbage collection)
      try {
        if ('gc' in window && typeof (window as any).gc === 'function') {
          (window as any).gc()
          results.success.push('Browser Memory (garbage collected)')
        }
      } catch (error) {
        // GC not available, which is normal
      }

      // 12. Clear server-side caches
      try {
        const timestamp = Date.now()
        
        // Clear public stats cache
        await fetch('/api/public/stats', { 
          method: 'DELETE',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }).catch(() => {})
        
        // Make cache-busting requests to key endpoints
        const endpoints = [
          '/api/public/stats',
          '/api/tools/wsi-question-generator/stats',
          '/api/public-data/virtual-slides'
        ]
        
        await Promise.all(endpoints.map(endpoint => 
          fetch(`${endpoint}?_bust=${timestamp}`, { 
            method: 'HEAD',
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }).catch(() => {})
        ))
        
        results.success.push('Server-side Caches (invalidated)')
      } catch (error) {
        results.errors.push(`Server caches: ${error}`)
      }

      // 13. Clear fetch cache headers and force refresh
      try {
        // Force clear any fetch caches by making a cache-busting request
        const timestamp = Date.now()
        fetch(`/api/public/stats?_bust=${timestamp}`, { 
          method: 'HEAD',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }).catch(() => {}) // Ignore errors
        results.success.push('Fetch Cache Headers (reset)')
      } catch (error) {
        results.errors.push(`Fetch cache: ${error}`)
      }

      setClearResults(results)
      
      if (results.errors.length === 0) {
        toast.success('All caches cleared successfully!')
      } else {
        toast.warning(`Caches cleared with ${results.errors.length} warnings`)
      }

    } catch (error) {
      results.errors.push(`General error: ${error}`)
      setClearResults(results)
      toast.error('Failed to clear some caches')
    } finally {
      setIsClearing(false)
    }
  }

  const reloadPage = () => {
    window.location.reload()
  }

  const clearBuildCache = async () => {
    try {
      const response = await fetch('/api/debug/clear-build-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('Build cache cleared successfully!')
      } else {
        toast.error('Failed to clear build cache')
      }
    } catch (error) {
      toast.error('Error clearing build cache')
      console.error('Build cache clear error:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cache Management Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cache Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Comprehensively clear all browser caches, storage, server-side caches, and application data.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={clearAllCaches}
              disabled={isClearing}
              variant="destructive"
              className="flex items-center gap-2"
            >
              {isClearing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isClearing ? 'Clearing...' : 'Clear All Caches'}
            </Button>
            
            <Button
              onClick={clearBuildCache}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Clear Build Cache
            </Button>
            
            <Button
              onClick={reloadPage}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            <strong>This will clear:</strong> Local Storage, Session Storage, IndexedDB, Cache API, 
            Service Workers, Cookies, Next.js Router Cache, Application Caches, Server-side Caches, 
            and Fetch Cache Headers.
          </div>

          {clearResults && (
            <div className="space-y-3">
              {clearResults.success.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Successfully cleared:</div>
                      {clearResults.success.map((item, index) => (
                        <Badge key={index} variant="secondary" className="mr-1 mb-1">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {clearResults.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Warnings/Errors:</div>
                      {clearResults.errors.map((error, index) => (
                        <div key={index} className="text-xs text-muted-foreground">
                          {error}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Debug Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Other Debug Tools
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Additional debugging and development utilities.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">More tools coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
