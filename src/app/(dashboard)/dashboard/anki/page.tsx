// src/app/(dashboard)/dashboard/anki/page.tsx
/**
 * Dashboard Anki Viewer Page
 * Interactive viewer for the Ankoma pathology deck with user-specific features
 * Authenticated users can study cards with progress tracking and personalization
 */

'use client'

import React from 'react'
import { DoubleSidebarAnkomaViewer } from '@/features/anki/components/double-sidebar-ankoma-viewer'
import { BookOpen, Brain, Shuffle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export default function DashboardAnkiPage() {
  return (
    <div className="h-screen flex flex-col">
      {/* Minimal Header */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-sm px-4 py-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Ankoma Deck</h1>
          <p className="text-sm text-muted-foreground">
            Interactive pathology flashcards with spaced repetition
          </p>
        </div>
      </div>
      
      {/* Anki Viewer - Full Height */}
      <div className="flex-1 overflow-hidden">
        <DoubleSidebarAnkomaViewer
          autoLoad={true}
          onSectionChange={(section) => {
            console.log('Selected section:', section.name)
          }}
          onError={(error) => {
            console.error('Anki viewer error:', error)
          }}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}

