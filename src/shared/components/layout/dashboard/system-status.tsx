// src/components/admin/dashboard/system-status.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { createClient } from '@/shared/services/client'

interface SystemMetrics {
  vercelStatus: 'operational' | 'error'
  supabaseStatus: 'operational' | 'error'
  cloudflareR2Status: 'operational' | 'error'
  responseTime: number
  dbQueryTime: number
  dbConnections: number
  activeUsers: number
  storageUsage: number // Supabase storage in MB
  r2StorageUsage: number // R2 storage in MB
  r2StorageFormatted: string // Formatted R2 storage
  lastUpdated: Date
}

export function SystemStatus() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    vercelStatus: 'operational',
    supabaseStatus: 'operational',
    cloudflareR2Status: 'operational',
    responseTime: 0,
    dbQueryTime: 0,
    dbConnections: 0,
    activeUsers: 0,
    storageUsage: 0,
    r2StorageUsage: 0,
    r2StorageFormatted: '0 MB',
    lastUpdated: new Date()
  })

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
            cloudflareR2Status: data.cloudflareR2Status || 'operational',
            responseTime: data.responseTime,
            dbQueryTime: data.dbQueryTime || 0,
            dbConnections: data.dbConnections || 0,
            activeUsers: data.activeUsers || 0,
            storageUsage: data.storageUsage || 0,
            r2StorageUsage: data.r2StorageUsage || 0,
            r2StorageFormatted: data.r2StorageFormatted || '0 MB',
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
            cloudflareR2Status: 'operational', // Default when API fails
            responseTime,
            dbQueryTime: 0,
            dbConnections: 0,
            activeUsers: 0,
            storageUsage: 0,
            r2StorageUsage: 0,
            r2StorageFormatted: '0 MB',
            lastUpdated: new Date()
          })
        }

      } catch (error) {
        console.error('System health check failed:', error)
        setMetrics({
          vercelStatus: 'operational',
          supabaseStatus: 'error',
          cloudflareR2Status: 'error',
          responseTime: 0,
          dbQueryTime: 0,
          dbConnections: 0,
          activeUsers: 0,
          storageUsage: 0,
          r2StorageUsage: 0,
          r2StorageFormatted: '0 MB',
          lastUpdated: new Date()
        })
      }
  }, [])

  useEffect(() => {
    checkSystemHealth()

    // Optimized: Check every 2 minutes instead of 30 seconds
    // This reduces database load significantly
    const interval = setInterval(checkSystemHealth, 120000)

    return () => clearInterval(interval)
  }, [checkSystemHealth])

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
    <div className="space-y-4">
      {/* System Status Header */}
      <Card>
        <CardHeader>
          <CardTitle>System Health & Monitoring</CardTitle>
          <p className="text-xs text-muted-foreground">
            Last updated: {metrics.lastUpdated.toLocaleTimeString()}
          </p>
        </CardHeader>
      </Card>

      {/* Service Status Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Vercel Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Vercel</p>
                <p className="text-xs text-muted-foreground">Hosting</p>
              </div>
              <div className={`h-3 w-3 rounded-full ${getStatusColor(metrics.vercelStatus)}`} />
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                {metrics.vercelStatus === 'operational' ? 'Operational' : 'Error'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Supabase Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Supabase</p>
                <p className="text-xs text-muted-foreground">Database</p>
              </div>
              <div className={`h-3 w-3 rounded-full ${getStatusColor(metrics.supabaseStatus)}`} />
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                {metrics.supabaseStatus === 'operational' ? 'Operational' : 'Error'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Response Time */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">API Response</p>
                <p className="text-xs text-muted-foreground">Total Time</p>
              </div>
              <div className={`h-3 w-3 rounded-full ${metrics.responseTime > 1000 ? 'bg-red-500' : metrics.responseTime > 300 ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                {metrics.responseTime}ms
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Database Query Time */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">DB Query</p>
                <p className="text-xs text-muted-foreground">Query Time</p>
              </div>
              <div className={`h-3 w-3 rounded-full ${metrics.dbQueryTime > 500 ? 'bg-red-500' : metrics.dbQueryTime > 100 ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                {metrics.dbQueryTime}ms
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold">1</p>
              <p className="text-xs text-muted-foreground">DB Connections</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{metrics.activeUsers}</p>
              <p className="text-xs text-muted-foreground">Active Users (60 min)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{metrics.r2StorageFormatted}</p>
              <p className="text-xs text-muted-foreground">Cloudflare R2</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{(metrics.storageUsage / 1024).toFixed(1)}GB</p>
              <p className="text-xs text-muted-foreground">Supabase Storage</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
