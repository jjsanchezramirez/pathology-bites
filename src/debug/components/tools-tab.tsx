// src/features/debug/components/tools-tab.tsx
/**
 * Tools Tab - Miscellaneous debug tools
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Settings } from 'lucide-react'

export function ToolsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Debug Tools
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Miscellaneous debugging and development tools.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Tools coming soon...</p>
        </CardContent>
      </Card>
    </div>
  )
}
