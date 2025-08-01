// src/app/debug/mobile-test/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useMobile } from '@/shared/hooks/use-mobile'
import { useTextZoom } from '@/shared/contexts/font-size-context'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

export default function MobileTestPage() {
  const isMobile = useMobile()
  const { textZoom, increaseTextZoom, decreaseTextZoom } = useTextZoom()
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState({ vh: 0, dvh: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const updateSizes = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })

      // Calculate viewport units
      const vh = window.innerHeight * 0.01
      const dvh = window.visualViewport?.height ? window.visualViewport.height * 0.01 : vh

      setViewportSize({ vh, dvh })
    }

    updateSizes()
    window.addEventListener('resize', updateSizes)
    window.addEventListener('orientationchange', updateSizes)

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateSizes)
    }

    return () => {
      window.removeEventListener('resize', updateSizes)
      window.removeEventListener('orientationchange', updateSizes)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateSizes)
      }
    }
  }, [])

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Mobile Detection Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Mobile Detected:</p>
                <p className={`text-lg font-bold ${isMobile ? 'text-green-600' : 'text-red-600'}`}>
                  {isMobile ? 'YES' : 'NO'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Text Zoom:</p>
                <p className="text-lg font-bold">{Math.round(textZoom * 100)}%</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Window Size:</p>
                <p className="text-sm">
                  {mounted ? `${windowSize.width} × ${windowSize.height}` : 'Loading...'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Fixed Breakpoint:</p>
                <p className="text-sm">1024px (viewport only)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">100vh:</p>
                <p className="text-sm">
                  {mounted ? `${Math.round(viewportSize.vh * 100)}px` : 'Loading...'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">100dvh:</p>
                <p className="text-sm">
                  {mounted ? `${Math.round(viewportSize.dvh * 100)}px` : 'Loading...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Text Zoom Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={decreaseTextZoom} variant="outline">
                Decrease Text
              </Button>
              <Button onClick={increaseTextZoom} variant="outline">
                Increase Text
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Text size changes should NOT affect mobile detection (viewport-based only)
            </p>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-medium text-blue-800">Expected Behavior:</p>
              <ul className="text-xs text-blue-700 mt-1 space-y-1">
                <li>• Mobile detection based only on viewport width (≤767px)</li>
                <li>• Text scaling should not trigger mobile/desktop mode changes</li>
                <li>• Resize browser window to test responsive behavior</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Viewport Height Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div 
                className="bg-blue-100 border-2 border-blue-300 rounded p-2 text-center"
                style={{ height: '100vh' }}
              >
                100vh height
              </div>
              <div 
                className="bg-green-100 border-2 border-green-300 rounded p-2 text-center"
                style={{ height: '100dvh' }}
              >
                100dvh height
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              On mobile, 100dvh should account for the address bar, while 100vh might not.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Agent Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs break-all">
              {mounted ? navigator.userAgent : 'Loading...'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
