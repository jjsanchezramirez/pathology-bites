// src/shared/components/dev/cache-debug.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { RefreshCw, AlertTriangle, CheckCircle, X } from 'lucide-react'

interface CacheInfo {
  headers: Record<string, string>
  timestamp: string
  url: string
}

export function CacheDebug() {
  const [isVisible, setIsVisible] = useState(false)
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
  const [lastUpdate, setLastUpdate] = useState(Date.now())

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const checkCacheHeaders = async () => {
    try {
      const response = await fetch('/api/user/dashboard/stats', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })

      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })

      setCacheInfo({
        headers,
        timestamp: new Date().toISOString(),
        url: response.url
      })
      setLastUpdate(Date.now())
    } catch (error) {
      console.error('Cache debug error:', error)
    }
  }

  useEffect(() => {
    if (isVisible) {
      checkCacheHeaders()
    }
  }, [isVisible])

  const isCacheDisabled = cacheInfo?.headers['x-development-cache-disabled'] === 'true'
  const cacheControl = cacheInfo?.headers['cache-control'] || 'Not set'

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Cache Debug
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="border-yellow-300 bg-yellow-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-yellow-800">
              Development Cache Debug
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-yellow-700">Cache Status:</span>
            <Badge variant={isCacheDisabled ? 'default' : 'destructive'}>
              {isCacheDisabled ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Disabled
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Enabled
                </>
              )}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-yellow-700">Cache-Control:</div>
            <div className="text-xs font-mono bg-yellow-100 p-2 rounded border">
              {cacheControl}
            </div>
          </div>

          {cacheInfo?.headers['x-development-timestamp'] && (
            <div className="space-y-2">
              <div className="text-xs text-yellow-700">Dev Timestamp:</div>
              <div className="text-xs font-mono bg-yellow-100 p-2 rounded border">
                {cacheInfo.headers['x-development-timestamp']}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs text-yellow-700">Last Check:</div>
            <div className="text-xs text-yellow-600">
              {new Date(lastUpdate).toLocaleTimeString()}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={checkCacheHeaders}
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
            >
              Hard Reload
            </Button>
          </div>

          <div className="text-xs text-yellow-600 bg-yellow-100 p-2 rounded border">
            <strong>Tips:</strong>
            <ul className="mt-1 ml-2 list-disc list-inside space-y-1">
              <li>Use Cmd+Shift+R for hard refresh</li>
              <li>Open DevTools → Network → Disable cache</li>
              <li>Try incognito mode for clean slate</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}