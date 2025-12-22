// src/app/(dashboard)/dashboard/anki/page.tsx
'use client'

import React from 'react'
import { DoubleSidebarAnkomaViewer } from '@/features/anki/components/double-sidebar-ankoma-viewer'

export default function AnkiPage() {
  return (
    <DoubleSidebarAnkomaViewer
      autoLoad={true}
      onSectionChange={(section) => {
        console.log('Selected section:', section.name)
      }}
      onError={(error) => {
        console.error('Anki viewer error:', error)
      }}
    />
  )
}
