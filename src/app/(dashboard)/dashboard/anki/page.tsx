// src/app/(dashboard)/dashboard/anki/page.tsx
/**
 * Dashboard Anki Viewer Page
 * Interactive viewer for the Ankoma pathology deck with user-specific features
 * Authenticated users can study cards with progress tracking and personalization
 */

'use client'

import React from 'react'
import { DoubleSidebarAnkomaViewer } from '@/features/anki/components/double-sidebar-ankoma-viewer'

export default function DashboardAnkiPage() {
  return (
    <div className="pb-24">
      <DoubleSidebarAnkomaViewer
        autoLoad={true}
        onSectionChange={(section) => {
          console.log('Selected section:', section.name)
        }}
        onError={(error) => {
          console.error('Anki viewer error:', error)
        }}
      />
    </div>
  )
}

