// src/app/(public)/test/r2-browser/page.tsx

'use client'

import { R2FileBrowser } from '@/features/debug/components/r2-file-browser'

export default function R2BrowserTestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">R2 Storage Browser Test</h1>
        <p className="text-muted-foreground">
          Test the enhanced R2 storage browser with folder navigation and improved file management
        </p>
      </div>

      <R2FileBrowser defaultBucket="pathology-bites-images" />
    </div>
  )
}
