// src/shared/components/common/public-hero.tsx
'use client'

/**
 * PublicHero - Standardized hero section component for public pages
 *
 * Usage Examples:
 *
 * 1. Simple hero with Dr. Albright (most common):
 * <PublicHero
 *   title="Privacy Policy"
 *   description="Your privacy is important to us..."
 * />
 *
 * 2. Hero with custom styling and actions:
 * <PublicHero
 *   title="About Pathology Bites"
 *   description="We believe quality education..."
 *   actions={<Button>Get Started</Button>}
 *   className="bg-gradient-to-br from-slate-50 to-blue-50/30"
 * />
 *
 * 3. Full-screen hero (like landing page):
 * <PublicHero
 *   fullScreen
 *   title={<h1 className="font-heading text-4xl...">Welcome to Pathology Bites</h1>}
 *   description="Master pathology with bite-sized learning"
 *   actions={<div className="flex gap-4"><Button>Sign Up</Button></div>}
 *   showCharacter={false}
 * />
 *
 * 4. Hero without Dr. Albright:
 * <PublicHero
 *   title="Coming Soon"
 *   description="We're working hard..."
 *   showCharacter={false}
 * />
 */

import { ReactNode } from 'react'
import FloatingCharacter from './dr-albright'

interface PublicHeroProps {
  /** Main heading text */
  title: string | ReactNode
  /** Supporting description text */
  description?: string | ReactNode
  /** Optional action buttons or other content */
  actions?: ReactNode
  /** Whether to show Dr. Albright character (default: true) */
  showCharacter?: boolean
  /** Whether to use full-screen hero style with gradients (default: false) */
  fullScreen?: boolean
  /** Additional CSS classes for the section */
  className?: string
  /** Additional CSS classes for the content container */
  contentClassName?: string
  /** Custom background content (for full-screen mode) */
  backgroundContent?: ReactNode
}

export function PublicHero({
  title,
  description,
  actions,
  showCharacter = true,
  fullScreen = false,
  className = '',
  contentClassName = '',
  backgroundContent
}: PublicHeroProps) {
  if (fullScreen) {
    return (
      <section className={`relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden ${className}`}>
        {/* Default background gradients for full-screen mode */}
        {!backgroundContent && (
          <>
            <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent animate-gradient" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.12),transparent_25%)] animate-gradient" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] animate-gradient" />
          </>
        )}
        
        {/* Custom background content */}
        {backgroundContent}
        
        {/* Content Container */}
        <div className={`container px-4 sm:px-6 lg:px-8 relative z-10 flex justify-center ${contentClassName}`}>
          <div className="relative max-w-5xl space-y-8 text-center">
            {/* Title */}
            {typeof title === 'string' ? (
              <h1 className="font-heading text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in">
                {title}
              </h1>
            ) : (
              title
            )}

            {/* Description */}
            {description && (
              <div className="space-y-6 animate-fade-in opacity-0" style={{ animationDelay: '0.5s' }}>
                {typeof description === 'string' ? (
                  <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
                    {description}
                  </p>
                ) : (
                  description
                )}
              </div>
            )}

            {/* Actions */}
            {actions && (
              <div className="space-y-6 animate-fade-in opacity-0" style={{ animationDelay: '0.9s' }}>
                {actions}
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  // Standard hero layout with optional Dr. Albright character
  return (
    <section className={`relative min-h-[calc(400px+3.5rem)] flex items-center mt-14 overflow-hidden ${className}`}>
      {/* Standard background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />

      <div className="container mx-auto px-4 max-w-6xl relative z-10 py-16 md:py-24 w-full">
        <div className="flex items-center justify-between gap-8">
          {/* Content */}
          <div className={`flex-1 space-y-6 max-w-2xl ${contentClassName}`}>
            {/* Title */}
            {typeof title === 'string' ? (
              <h1 className="text-3xl md:text-5xl font-bold">
                {title}
              </h1>
            ) : (
              title
            )}

            {/* Description */}
            {description && (
              typeof description === 'string' ? (
                <p className="text-lg text-muted-foreground">
                  {description}
                </p>
              ) : (
                description
              )
            )}

            {/* Actions */}
            {actions}
          </div>

          {/* Character - hidden on mobile */}
          {showCharacter && (
            <div className="hidden md:block w-[350px]">
              <FloatingCharacter
                imagePath="https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/static/images/dr-albright.png"
                imageAlt="Dr. Albright Character"
                size={350}
                wrapperClassName="w-full flex justify-center"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
