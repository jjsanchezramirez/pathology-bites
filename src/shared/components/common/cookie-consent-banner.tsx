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
    setMounted(true)
    
    // Check if user has already consented
    const savedConsent = localStorage.getItem(CONSENT_KEY)
    
    if (savedConsent) {
      try {
        const consent: CookieConsent = JSON.parse(savedConsent)
        
        // Check if consent version matches
        if (consent.version === CONSENT_VERSION) {
          // Apply consent preferences
          applyConsent(consent)
          return
        }
      } catch (e) {
        // Invalid consent data, show banner
      }
    }
    
    // Show banner after a short delay for better UX
    setTimeout(() => setShowBanner(true), 1000)
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
    const consent: CookieConsent = {
      version: CONSENT_VERSION,
      essential: true,
      analytics,
      timestamp: new Date().toISOString()
    }
    
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    applyConsent(consent)
    setShowBanner(false)
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
      <div className="fixed bottom-6 left-6 z-[100] pointer-events-none max-w-md">
        <Card className="pointer-events-auto animate-in slide-in-from-left duration-500 shadow-2xl border border-border bg-card">
          <div className="p-6">
            <div className="space-y-4">
              {/* Header with close button */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-primary/10">
                    <Cookie className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Take a bite of our cookies</h3>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReject}
                  className="shrink-0 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                We use cookies to keep you logged in and improve your learning experience.
              </p>

              {/* Actions - stacked vertically for compact design */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleAcceptAll}
                  className="w-full bg-primary hover:bg-primary/90"
                  size="default"
                >
                  Accept All
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAcceptEssential}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    Essential Only
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="ghost"
                    className="flex-1"
                    size="sm"
                  >
                    Reject
                  </Button>
                </div>
              </div>

              {/* Privacy Policy Link */}
              <p className="text-xs text-muted-foreground">
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

