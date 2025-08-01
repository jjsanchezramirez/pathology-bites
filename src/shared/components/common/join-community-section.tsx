// src/shared/components/common/join-community-section.tsx
'use client'

import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'

interface JoinCommunitySectionProps {
  title?: string
  description?: string
  showCreateAccount?: boolean
  showDiscord?: boolean
  className?: string
}

export function JoinCommunitySection({
  title = "Join Our Learning Community",
  description = "Ready to take your pathology education to the next level? Create a free account and access our comprehensive question bank, interactive quizzes, and study tools.",
  showCreateAccount = true,
  showDiscord = true,
  className = ""
}: JoinCommunitySectionProps) {
  const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

  // Override props for coming soon mode
  const finalTitle = isComingSoon ? "Get Notified When We Launch" : title
  const finalDescription = isComingSoon
    ? "Be the first to know when Pathology Bites goes live. Subscribe to receive launch updates and join our community."
    : description
  const finalShowCreateAccount = isComingSoon ? false : showCreateAccount

  return (
    <section className={`relative py-20 ${className}`}>
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
      <div className="container px-4 max-w-3xl mx-auto text-center relative">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">{finalTitle}</h2>
        <p className="text-xl text-muted-foreground mb-8">
          {finalDescription}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {finalShowCreateAccount && (
            <Link href="/signup" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 transform hover:scale-105
                          transition-all duration-300 ease-in-out w-full"
              >
                Create Free Account
              </Button>
            </Link>
          )}
          {isComingSoon && (
            <Link href="/" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 transform hover:scale-105
                          transition-all duration-300 ease-in-out w-full"
              >
                Get Launch Updates
              </Button>
            </Link>
          )}
          {showDiscord && (
            <Link href="https://discord.gg/2v64p2fzsC" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="bg-[#5865F2] hover:bg-[#4752C4] hover:text-white text-white px-8 w-full
                  transform hover:scale-105 active:scale-95
                  hover:shadow-xl hover:shadow-[#5865F2]/20
                  transition-all duration-300 ease-in-out
                  relative overflow-hidden flex items-center justify-center gap-2"
                aria-label="Join our Discord community"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Join Discord
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
