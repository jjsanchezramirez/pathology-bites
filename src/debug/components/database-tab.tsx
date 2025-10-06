// src/features/debug/components/database-tab.tsx
/**
 * Database Tab - Database inspection and testing
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Database, RefreshCw } from 'lucide-react'

export function DatabaseTab() {
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')

  const testConnection = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/public/health')
      if (res.ok) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('error')
      }
    } catch (error) {
      setConnectionStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Tools
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Database connection testing and basic inspection tools.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Connection Status:</span>
            <div className="flex items-center gap-2">
              <Badge variant={
                connectionStatus === 'connected' ? 'default' : 
                connectionStatus === 'error' ? 'destructive' : 
                'outline'
              }>
                {connectionStatus === 'connected' ? 'Connected' : 
                 connectionStatus === 'error' ? 'Error' : 
                 'Unknown'}
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={testConnection}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Test'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
