// src/features/debug/components/r2-storage-tab.tsx
/**
 * R2 Storage Tab - Cloudflare R2 storage testing
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { HardDrive, RefreshCw } from 'lucide-react'

export function R2StorageTab() {
  const [loading, setLoading] = useState(false)
  const [storageStatus, setStorageStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')

  const testStorage = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/r2/files')
      if (res.ok) {
        setStorageStatus('connected')
      } else {
        setStorageStatus('error')
      }
    } catch (error) {
      setStorageStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Cloudflare R2 Storage
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test Cloudflare R2 storage connectivity and file operations.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Storage Status:</span>
            <div className="flex items-center gap-2">
              <Badge variant={
                storageStatus === 'connected' ? 'default' : 
                storageStatus === 'error' ? 'destructive' : 
                'outline'
              }>
                {storageStatus === 'connected' ? 'Connected' : 
                 storageStatus === 'error' ? 'Error' : 
                 'Unknown'}
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={testStorage}
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
