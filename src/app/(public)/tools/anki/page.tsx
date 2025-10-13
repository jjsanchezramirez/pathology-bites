// src/app/(public)/tools/anki/page.tsx
/**
 * Public Anki Tool Page
 * Interactive viewer for the Ankoma pathology deck with section navigation
 * Public preview version - authenticated users can access enhanced features in the dashboard
 */

'use client'

import React from 'react'
import Link from 'next/link'
import { PublicHero } from '@/shared/components/common/public-hero'
import { DoubleSidebarAnkomaViewer } from '@/features/anki/components/double-sidebar-ankoma-viewer'
import { BookOpen, Brain, Shuffle, ArrowRight } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useSimpleAuth } from '@/shared/hooks/use-simple-auth'

export default function AnkiPage() {
  const { isAuthenticated } = useSimpleAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHero
        title="Anki Deck Viewer"
        description="Interactive viewer for the Ankoma pathology deck. Study thousands of pathology cards with spaced repetition and dual sidebar navigation."
        actions={
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                <span>15,000+ Cards</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Brain className="h-4 w-4" />
                <span>Interactive Clozes</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shuffle className="h-4 w-4" />
                <span>Organized by Topic</span>
              </div>
            </div>
            {isAuthenticated && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <span className="text-sm text-foreground">
                  💡 <strong>Tip:</strong> Access the full-featured version with progress tracking in your dashboard
                </span>
                <Button asChild size="sm" variant="default">
                  <Link href="/dashboard/anki">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
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
