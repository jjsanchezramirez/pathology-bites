// src/features/debug/components/system-tab.tsx
/**
 * System Tab - System information and environment
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Server } from 'lucide-react'

export function SystemTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Information
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Environment variables and system status.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between">
              <span>Environment:</span>
              <Badge>{process.env.NODE_ENV || 'development'}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Next.js Version:</span>
              <Badge variant="outline">15.x</Badge>
            </div>
            <div className="flex justify-between">
              <span>React Version:</span>
              <Badge variant="outline">18.x</Badge>
            </div>
            <div className="flex justify-between">
              <span>TypeScript:</span>
              <Badge variant="outline">5.x</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
