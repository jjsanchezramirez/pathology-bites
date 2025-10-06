// src/features/debug/components/r2-storage-tab.tsx
/**
 * R2 Storage Tab - Cloudflare R2 storage information
 * Note: R2 file management is handled through external GitHub browser
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { HardDrive, ExternalLink, Github } from 'lucide-react'

export function R2StorageTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Cloudflare R2 Storage
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            R2 storage information and external management tools.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Storage Management:</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                External GitHub Browser
              </Badge>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex items-start gap-3">
              <Github className="h-5 w-5 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <h4 className="font-medium text-sm">R2 File Management</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  R2 storage files are managed through an independent GitHub-based browser tool.
                  This provides better performance and more advanced file management capabilities
                  than built-in debug endpoints.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Active Buckets:</span>
              <div className="mt-1 space-y-1 text-muted-foreground">
                <div>• pathology-bites-images</div>
                <div>• pathology-bites-data</div>
              </div>
            </div>
            <div>
              <span className="font-medium">Access Method:</span>
              <div className="mt-1 space-y-1 text-muted-foreground">
                <div>• Direct R2 API access</div>
                <div>• GitHub browser interface</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
