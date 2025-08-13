// src/app/(public)/tools/anki/page.tsx
/**
 * Anki Tool Page
 * Interactive viewer for the Ankoma pathology deck with section navigation
 */

'use client'

import React from 'react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { DoubleSidebarAnkomaViewer } from '@/features/anki/components/double-sidebar-ankoma-viewer'
import { BookOpen, Brain, Shuffle } from 'lucide-react'

export default function AnkiPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHero
        title="Anki Deck Viewer"
        description="Interactive viewer for the Ankoma pathology deck. Study thousands of pathology cards with spaced repetition and dual sidebar navigation."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>15,000+ Cards</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              <span>Spaced Repetition</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shuffle className="h-4 w-4" />
              <span>Randomized Study</span>
            </div>
          </div>
        }
      />
      
      <section className="relative flex-1">
        <div className="h-[calc(100vh-200px)] min-h-[600px]">
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
      </section>
    </div>
  )
}
