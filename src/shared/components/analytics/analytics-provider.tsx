// src/shared/components/analytics/analytics-provider.tsx
'use client'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

// Google Analytics 4 configuration
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

// Custom event tracking functions
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      ...parameters,
      timestamp: new Date().toISOString(),
    })
  }
}

// Educational interaction tracking
export const trackQuizStart = (quizId: string, category: string, questionCount: number) => {
  trackEvent('quiz_start', {
    quiz_id: quizId,
    category,
    question_count: questionCount,
    event_category: 'education',
  })
}

export const trackQuizComplete = (
  quizId: string,
  category: string,
  score: number,
  totalQuestions: number,
  timeSpent: number
) => {
  trackEvent('quiz_complete', {
    quiz_id: quizId,
    category,
    score,
    total_questions: totalQuestions,
    time_spent_seconds: timeSpent,
    score_percentage: Math.round((score / totalQuestions) * 100),
    event_category: 'education',
  })
}

export const trackQuestionAnswer = (
  questionId: string,
  category: string,
  isCorrect: boolean,
  timeSpent: number,
  difficulty?: string
) => {
  trackEvent('question_answer', {
    question_id: questionId,
    category,
    is_correct: isCorrect,
    time_spent_seconds: timeSpent,
    difficulty,
    event_category: 'education',
  })
}

export const trackStudyMaterialView = (materialType: string, materialId: string, category?: string) => {
  trackEvent('study_material_view', {
    material_type: materialType,
    material_id: materialId,
    category,
    event_category: 'education',
  })
}

export const trackSearchQuery = (query: string, resultCount: number, searchType: string) => {
  trackEvent('search', {
    search_term: query,
    result_count: resultCount,
    search_type: searchType,
    event_category: 'engagement',
  })
}

export const trackUserRegistration = (method: string) => {
  trackEvent('sign_up', {
    method,
    event_category: 'user_lifecycle',
  })
}

export const trackUserLogin = (method: string) => {
  trackEvent('login', {
    method,
    event_category: 'user_lifecycle',
  })
}

// Page view tracking component
function PageTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      const searchParamsString = searchParams?.toString() || ''
      const url = pathname + (searchParamsString ? `?${searchParamsString}` : '')

      window.gtag('config', GA_MEASUREMENT_ID!, {
        page_location: window.location.href,
        page_path: url,
        page_title: document.title,
      })

      // Track page view
      window.gtag('event', 'page_view', {
        page_location: window.location.href,
        page_path: url,
        page_title: document.title,
      })
    }
  }, [pathname, searchParams])

  return null
}

interface AnalyticsProviderProps {
  children: React.ReactNode
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  return (
    <>
      {/* Google Analytics 4 */}
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              // Set default consent to denied (will be updated by cookie banner)
              gtag('consent', 'default', {
                'analytics_storage': 'denied'
              });

              gtag('config', '${GA_MEASUREMENT_ID}', {
                'anonymize_ip': true,
                'cookie_flags': 'SameSite=None;Secure'
              });
            `}
          </Script>

          {/* Page tracking wrapped in Suspense */}
          <Suspense fallback={null}>
            <PageTracker />
          </Suspense>
        </>
      )}

      {/* Vercel Analytics */}
      <Analytics />

      {/* Vercel Speed Insights */}
      <SpeedInsights />

      {children}
    </>
  )
}

// Declare gtag function for TypeScript
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set' | 'consent',
      targetId: string | Date | 'default' | 'update',
      config?: Record<string, any>
    ) => void
    dataLayer: any[]
  }
}
