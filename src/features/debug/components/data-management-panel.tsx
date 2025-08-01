// src/features/debug/components/data-management-panel.tsx
/**
 * Data Management Panel - Database seeding and cache management
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  Play, 
  AlertTriangle,
  HardDrive,
  Clock
} from 'lucide-react'
import { DebugPanelState, DebugAccessLevel } from '@/shared/types/debug'
import { toast } from '@/shared/utils/toast'

interface DataManagementPanelProps {
  debugState: DebugPanelState
  executeAction: (action: string, payload?: any) => Promise<any>
  accessLevel: DebugAccessLevel
}

export function DataManagementPanel({ 
  debugState, 
  executeAction, 
  accessLevel 
}: DataManagementPanelProps) {
  const [runningScript, setRunningScript] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // Mock seed scripts
  const seedScripts = [
    {
      id: 'demo_questions',
      name: 'Demo Questions',
      description: 'Seed database with sample questions for testing',
      category: 'questions',
      estimatedTime: '2-3 minutes',
      dataSize: '~50 questions',
      destructive: false
    },
    {
      id: 'test_users',
      name: 'Test Users',
      description: 'Create test users with different roles',
      category: 'users',
      estimatedTime: '30 seconds',
      dataSize: '~20 users',
      destructive: false
    },
    {
      id: 'sample_categories',
      name: 'Sample Categories',
      description: 'Add sample question categories and tags',
      category: 'categories',
      estimatedTime: '1 minute',
      dataSize: '~15 categories, 50 tags',
      destructive: false
    },
    {
      id: 'full_reset',
      name: 'Full Database Reset',
      description: 'WARNING: Completely reset database to initial state',
      category: 'all',
      estimatedTime: '5-10 minutes',
      dataSize: 'Complete reset',
      destructive: true
    }
  ]

  // Mock cache layers
  const cacheLayers = [
    {
      id: 'browser_cache',
      name: 'Browser Cache',
      description: 'Clear browser cache and local storage',
      type: 'browser',
      size: '~2.5 MB',
      lastCleared: '2024-01-15T10:30:00Z'
    },
    {
      id: 'application_cache',
      name: 'Application Cache',
      description: 'Clear server-side application cache',
      type: 'application',
      size: '~15 MB',
      lastCleared: '2024-01-15T09:15:00Z'
    },
    {
      id: 'database_cache',
      name: 'Database Query Cache',
      description: 'Clear PostgreSQL query cache',
      type: 'database',
      size: '~8 MB',
      lastCleared: '2024-01-15T08:45:00Z'
    },
    {
      id: 'cdn_cache',
      name: 'CDN Cache',
      description: 'Purge Vercel/CDN edge cache',
      type: 'cdn',
      size: '~25 MB',
      lastCleared: '2024-01-14T16:20:00Z'
    }
  ]

  const runSeedScript = async (scriptId: string) => {
    const script = seedScripts.find(s => s.id === scriptId)
    if (!script) return

    if (script.destructive) {
      const confirmed = window.confirm(
        `WARNING: This will ${script.description.toLowerCase()}. This action cannot be undone. Are you sure?`
      )
      if (!confirmed) return
    }

    setRunningScript(scriptId)
    setProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 20
        })
      }, 500)

      await executeAction('RUN_SEED_SCRIPT', { id: scriptId })
      
      clearInterval(progressInterval)
      setProgress(100)
      
      setTimeout(() => {
        setRunningScript(null)
        setProgress(0)
      }, 1000)

      toast.success(`${script.name} completed successfully`)
    } catch (error) {
      setRunningScript(null)
      setProgress(0)
      toast.error(`Failed to run ${script.name}`)
    }
  }

  const clearCache = async (cacheId: string) => {
    try {
      await executeAction('CLEAR_CACHE', { id: cacheId })
      toast.success('Cache cleared successfully')
    } catch (error) {
      toast.error('Failed to clear cache')
    }
  }

  if (accessLevel !== 'admin') {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Data management features require admin access level.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="seeding" className="space-y-4">
        <TabsList>
          <TabsTrigger value="seeding">Database Seeding</TabsTrigger>
          <TabsTrigger value="cache">Cache Management</TabsTrigger>
        </TabsList>

        <TabsContent value="seeding">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Database Seeding Scripts</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {seedScripts.map(script => (
                <div key={script.id} className={`p-4 border rounded-lg ${
                  script.destructive ? 'border-red-200 bg-red-50' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">{script.name}</h3>
                        <Badge variant="outline">{script.category}</Badge>
                        {script.destructive && (
                          <Badge variant="destructive">Destructive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {script.description}
                      </p>
                    </div>
                    <Button
                      onClick={() => runSeedScript(script.id)}
                      disabled={runningScript !== null}
                      variant={script.destructive ? 'destructive' : 'default'}
                      size="sm"
                    >
                      {runningScript === script.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Run Script
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{script.estimatedTime}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <HardDrive className="h-4 w-4" />
                      <span>{script.dataSize}</span>
                    </div>
                  </div>

                  {runningScript === script.id && (
                    <div className="mt-3">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-muted-foreground mt-1">
                        Progress: {Math.round(progress)}%
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5" />
                <span>Cache Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cacheLayers.map(cache => (
                <div key={cache.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-medium">{cache.name}</h3>
                      <Badge variant="outline">{cache.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {cache.description}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <HardDrive className="h-4 w-4" />
                        <span>{cache.size}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>Last cleared: {new Date(cache.lastCleared).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearCache(cache.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              ))}

              <div className="border-t pt-4">
                <Button
                  variant="destructive"
                  onClick={() => {
                    const confirmed = window.confirm(
                      'This will clear ALL cache layers. Are you sure?'
                    )
                    if (confirmed) {
                      cacheLayers.forEach(cache => clearCache(cache.id))
                    }
                  }}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Caches
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
