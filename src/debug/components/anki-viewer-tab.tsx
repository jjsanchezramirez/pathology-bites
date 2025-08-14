// src/features/debug/components/anki-viewer-tab.tsx
/**
 * Anki Viewer Tab - Debug interface for viewing Anki cards with sidebar navigation
 */

'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { BookOpen } from 'lucide-react'
import { DoubleSidebarAnkomaViewer } from '../features/anki/double-sidebar-ankoma-viewer'

export function AnkiViewerTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Anki Deck Viewer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Interactive viewer for the Ankoma pathology deck with sidebar navigation.
            Automatically loads ankoma.json and provides subdeck selection.
          </p>
        </CardHeader>
      </Card>

      {/* Anki Viewer */}
      <div className="h-[800px] border rounded-lg overflow-hidden bg-background">
        <DoubleSidebarAnkomaViewer />
      </div>
    </div>
  )
}
