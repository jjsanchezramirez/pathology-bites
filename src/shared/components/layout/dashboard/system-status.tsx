// src/components/admin/dashboard/system-status.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { createClient } from '@/shared/services/client'

interface SystemMetrics {
  vercelStatus: 'operational' | 'error'
  supabaseStatus: 'operational' | 'error'
  responseTime: number
  lastUpdated: Date
}

export function SystemStatus() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    vercelStatus: 'operational',
    supabaseStatus: 'operational',
    responseTime: 0,
    lastUpdated: new Date()
  })

  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const checkSystemHealth = useCallback(async () => {
      try {
        // Use the API endpoint for consistency
        const response = await fetch('/api/admin/system-status')

        if (response.ok) {
          const data = await response.json()

          setMetrics({
            vercelStatus: data.vercelStatus,
            supabaseStatus: data.supabaseStatus,
            responseTime: data.responseTime,
            lastUpdated: new Date(data.lastUpdated)
          })
        } else {
          // If API fails, fall back to direct check
          const startTime = performance.now()
          const { data, error } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .limit(1)

          const endTime = performance.now()
          const responseTime = Math.round(endTime - startTime)

          setMetrics({
            vercelStatus: 'operational',
            supabaseStatus: error ? 'error' : 'operational',
            responseTime,
            lastUpdated: new Date()
          })
        }

      } catch (error) {
        console.error('System health check failed:', error)
        setMetrics({
          vercelStatus: 'operational',
          supabaseStatus: 'error',
          responseTime: 0,
          lastUpdated: new Date()
        })
      } finally {
        setIsLoading(false)
      }
  }, [])

  useEffect(() => {
    checkSystemHealth()

    // Optimized: Check every 2 minutes instead of 30 seconds
    // This reduces database load significantly
    const interval = setInterval(checkSystemHealth, 120000)

    return () => clearInterval(interval)
  }, [checkSystemHealth])



  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-emerald-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
        <p className="text-xs text-muted-foreground">
          Last updated: {metrics.lastUpdated.toLocaleTimeString()}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Vercel (Hosting)</p>
              <div className="flex items-center">
                <div className={`h-2 w-2 rounded-full mr-2 ${getStatusColor(metrics.vercelStatus)}`} />
                <p className="text-sm text-muted-foreground">
                  {metrics.vercelStatus === 'operational' ? 'Operational' : 'Error'}
                </p>
              </div>
            </div>
            <p className="text-sm font-medium text-emerald-500">
              Online
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Supabase (Database)</p>
              <div className="flex items-center">
                <div className={`h-2 w-2 rounded-full mr-2 ${getStatusColor(metrics.supabaseStatus)}`} />
                <p className="text-sm text-muted-foreground">
                  {metrics.supabaseStatus === 'operational' ? 'Connected' : 'Connection Error'}
                </p>
              </div>
            </div>
            <p className="text-sm font-medium">
              {metrics.responseTime}ms
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
