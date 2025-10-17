// src/shared/components/common/cookie-consent-banner.tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { X, Cookie } from 'lucide-react'

const CONSENT_KEY = 'pathology-bites-cookie-consent'
const CONSENT_VERSION = '1.0' // Increment this if you update the policy

interface CookieConsent {
  version: string
  essential: boolean // Always true
  analytics: boolean
  timestamp: string
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    setMounted(true)

    // Check if user has already consented
    try {
      const savedConsent = localStorage.getItem(CONSENT_KEY)

      if (savedConsent) {
        const consent: CookieConsent = JSON.parse(savedConsent)

        // Check if consent version matches
        if (consent.version === CONSENT_VERSION) {
          // Apply consent preferences and don't show banner
          applyConsent(consent)
          setShowBanner(false)
          return
        }
      }
    } catch (e) {
      console.warn('[CookieConsent] Failed to parse saved consent:', e)
      // Invalid consent data, show banner
    }

    // Show banner after a short delay for better UX
    const timer = setTimeout(() => setShowBanner(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const applyConsent = (consent: CookieConsent) => {
    // Apply analytics consent
    if (consent.analytics && typeof window !== 'undefined') {
      // Enable Google Analytics
      if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
        // GA4 is already loaded in layout, just enable it
        window.gtag?.('consent', 'update', {
          analytics_storage: 'granted'
        })
      }
    } else {
      // Disable analytics
      window.gtag?.('consent', 'update', {
        analytics_storage: 'denied'
      })
    }
  }

  const saveConsent = (analytics: boolean) => {
    try {
      const consent: CookieConsent = {
        version: CONSENT_VERSION,
        essential: true,
        analytics,
        timestamp: new Date().toISOString()
      }

      // Save to localStorage
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))

      // Verify it was saved
      const saved = localStorage.getItem(CONSENT_KEY)
      if (!saved) {
        console.warn('[CookieConsent] Failed to save consent to localStorage')
        return
      }

      // Apply consent preferences
      applyConsent(consent)
      setShowBanner(false)
      console.log('[CookieConsent] Consent saved:', { analytics, timestamp: consent.timestamp })
    } catch (error) {
      console.error('[CookieConsent] Failed to save consent:', error)
    }
  }

  const handleAcceptAll = () => {
    saveConsent(true)
  }

  const handleAcceptEssential = () => {
    saveConsent(false)
  }

  const handleReject = () => {
    saveConsent(false)
  }

  // Don't render on server or if already consented
  if (!mounted || !showBanner) {
    return null
  }

  return (
    <>
      {/* Bottom-left toast-style banner */}
      <div className="fixed bottom-4 left-4 z-[100] pointer-events-none max-w-xs">
        <Card className="pointer-events-auto animate-in slide-in-from-left duration-500 shadow-2xl border border-border bg-card">
          <div className="p-4">
            <div className="space-y-3">
              {/* Header with close button */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-primary/10 shrink-0">
                    <Cookie className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Take a bite of our cookies</h3>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReject}
                  className="shrink-0 h-6 w-6"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                We use cookies to keep you logged in and improve your learning experience.
              </p>

              {/* Actions - stacked vertically for compact design */}
              <div className="flex flex-col gap-1.5">
                <Button
                  onClick={handleAcceptAll}
                  className="w-full bg-primary hover:bg-primary/90 text-xs h-8"
                  size="sm"
                >
                  Accept All
                </Button>
                <div className="flex gap-1.5">
                  <Button
                    onClick={handleAcceptEssential}
                    variant="outline"
                    className="flex-1 text-xs h-7"
                    size="sm"
                  >
                    Essential Only
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="ghost"
                    className="flex-1 text-xs h-7"
                    size="sm"
                  >
                    Reject
                  </Button>
                </div>
              </div>

              {/* Privacy Policy Link */}
              <p className="text-[10px] text-muted-foreground">
                <a href="/privacy" className="text-primary hover:underline font-medium">
                  Privacy Policy
                </a>
                {' • '}
                <a href="/terms" className="text-primary hover:underline font-medium">
                  Terms
                </a>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

