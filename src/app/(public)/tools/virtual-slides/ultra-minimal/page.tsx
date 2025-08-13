/**
 * Ultra-minimal virtual slides test page
 * Tests the 2-file strategy implementation
 */

'use client'

import { VirtualSlidesUltraMinimal } from '../components/virtual-slides-ultra-minimal'

export default function UltraMinimalVirtualSlidesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Ultra-Minimal Virtual Slides (Test)
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Testing the 2-file strategy: 2.5 MB initial transfer + on-demand detail loading
          </p>
        </div>
        
        <VirtualSlidesUltraMinimal />
      </div>
    </div>
  )
}
