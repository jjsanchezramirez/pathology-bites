// src/features/debug/components/ui-components-tab.tsx
/**
 * UI Components Tab - Test UI components
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Palette } from 'lucide-react'

export function UiComponentsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            UI Components Showcase
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test and preview UI components in isolation.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium">Buttons</h3>
              <div className="flex flex-wrap gap-2">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-medium">Badges</h3>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="font-medium">Inputs</h3>
              <Input placeholder="Text input" />
              <Textarea placeholder="Textarea input" rows={3} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
