// src/features/debug/components/system-tab.tsx
/**
 * System Tab - System information and environment details
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { 
  Server, 
  Globe, 
  Database, 
  Shield, 
  Clock,
  Monitor,
  Cpu,
  HardDrive,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'

export function SystemTab() {
  const [systemInfo, setSystemInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetchSystemInfo()
  }, [])

  const fetchSystemInfo = async () => {
    setLoading(true)
    try {
      // Gather client-side system information
      const info = {
        environment: {
          nodeEnv: process.env.NODE_ENV,
          maintenanceMode: process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true',
          comingSoonMode: process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true',
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...'
        },
        browser: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          languages: navigator.languages,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine
        },
        screen: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth
        },
        window: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        performance: {
          memory: (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          } : null,
          timing: {
            navigationStart: performance.timing.navigationStart,
            loadEventEnd: performance.timing.loadEventEnd,
            domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd
          }
        },
        storage: {
          localStorage: typeof localStorage !== 'undefined',
          sessionStorage: typeof sessionStorage !== 'undefined',
          indexedDB: typeof indexedDB !== 'undefined'
        },
        features: {
          serviceWorker: 'serviceWorker' in navigator,
          webGL: !!document.createElement('canvas').getContext('webgl'),
          webGL2: !!document.createElement('canvas').getContext('webgl2'),
          webAssembly: typeof WebAssembly !== 'undefined',
          intersectionObserver: 'IntersectionObserver' in window,
          mutationObserver: 'MutationObserver' in window
        },
        timestamp: new Date().toISOString()
      }

      setSystemInfo(info)
    } catch (error) {
      console.error('Error fetching system info:', error)
      toast.error('Failed to fetch system information')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      toast.success(`${label} copied to clipboard`)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading system information...</span>
      </div>
    )
  }

  if (!systemInfo) {
    return (
      <div className="text-center py-12">
        <Server className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Failed to load system information</p>
        <Button onClick={fetchSystemInfo} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">System Information</h2>
          <p className="text-gray-600">Environment details and system diagnostics</p>
        </div>
        <Button onClick={fetchSystemInfo} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Environment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>Environment</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Environment:</span>
              <Badge variant={systemInfo.environment.nodeEnv === 'development' ? 'default' : 'secondary'}>
                {systemInfo.environment.nodeEnv?.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Maintenance Mode:</span>
              <Badge variant={systemInfo.environment.maintenanceMode ? 'destructive' : 'secondary'}>
                {systemInfo.environment.maintenanceMode ? 'ENABLED' : 'DISABLED'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Coming Soon Mode:</span>
              <Badge variant={systemInfo.environment.comingSoonMode ? 'destructive' : 'secondary'}>
                {systemInfo.environment.comingSoonMode ? 'ENABLED' : 'DISABLED'}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Site URL:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(systemInfo.environment.siteUrl, 'Site URL')}
                >
                  {copied === 'Site URL' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 font-mono">{systemInfo.environment.siteUrl}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Supabase URL:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(systemInfo.environment.supabaseUrl, 'Supabase URL')}
                >
                  {copied === 'Supabase URL' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 font-mono">{systemInfo.environment.supabaseUrl}</p>
            </div>
          </CardContent>
        </Card>

        {/* Browser Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>Browser</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Language:</span>
              <Badge variant="outline">{systemInfo.browser.language}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Platform:</span>
              <Badge variant="outline">{systemInfo.browser.platform}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cookies:</span>
              <Badge variant={systemInfo.browser.cookieEnabled ? 'default' : 'destructive'}>
                {systemInfo.browser.cookieEnabled ? 'ENABLED' : 'DISABLED'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Online:</span>
              <Badge variant={systemInfo.browser.onLine ? 'default' : 'destructive'}>
                {systemInfo.browser.onLine ? 'YES' : 'NO'}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">User Agent:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(systemInfo.browser.userAgent, 'User Agent')}
                >
                  {copied === 'User Agent' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 break-all">{systemInfo.browser.userAgent}</p>
            </div>
          </CardContent>
        </Card>

        {/* Screen & Window */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>Display</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Screen Resolution:</span>
              <Badge variant="outline">
                {systemInfo.screen.width} × {systemInfo.screen.height}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Available Screen:</span>
              <Badge variant="outline">
                {systemInfo.screen.availWidth} × {systemInfo.screen.availHeight}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Window Size:</span>
              <Badge variant="outline">
                {systemInfo.window.innerWidth} × {systemInfo.window.innerHeight}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Device Pixel Ratio:</span>
              <Badge variant="outline">{systemInfo.window.devicePixelRatio}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Color Depth:</span>
              <Badge variant="outline">{systemInfo.screen.colorDepth} bit</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Performance & Memory */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cpu className="h-5 w-5" />
              <span>Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {systemInfo.performance.memory && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Used JS Heap:</span>
                  <Badge variant="outline">
                    {formatBytes(systemInfo.performance.memory.usedJSHeapSize)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total JS Heap:</span>
                  <Badge variant="outline">
                    {formatBytes(systemInfo.performance.memory.totalJSHeapSize)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">JS Heap Limit:</span>
                  <Badge variant="outline">
                    {formatBytes(systemInfo.performance.memory.jsHeapSizeLimit)}
                  </Badge>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Page Load Time:</span>
              <Badge variant="outline">
                {Math.round(systemInfo.performance.timing.loadEventEnd - systemInfo.performance.timing.navigationStart)}ms
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Features Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Feature Support</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(systemInfo.features).map(([feature, supported]) => (
              <div key={feature} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {feature.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <Badge variant={supported ? 'default' : 'secondary'}>
                  {supported ? 'SUPPORTED' : 'NOT SUPPORTED'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Storage Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5" />
              <span>Storage</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(systemInfo.storage).map(([storage, supported]) => (
              <div key={storage} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {storage.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <Badge variant={supported ? 'default' : 'secondary'}>
                  {supported ? 'AVAILABLE' : 'NOT AVAILABLE'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Timestamp */}
      <div className="text-center text-sm text-gray-500">
        <Clock className="h-4 w-4 inline mr-1" />
        Last updated: {new Date(systemInfo.timestamp).toLocaleString()}
      </div>
    </div>
  )
}
