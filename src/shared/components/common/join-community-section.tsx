// src/shared/components/common/join-community-section.tsx
'use client'

import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { Icons } from '@/shared/components/common/icons'

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
  return (
    <section className={`relative py-20 ${className}`}>
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
      <div className="container px-4 max-w-3xl mx-auto text-center relative">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
        <p className="text-xl text-muted-foreground mb-8">
          {description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {showCreateAccount && (
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 transform hover:scale-105
                          transition-all duration-300 ease-in-out"
              >
                Create Free Account
              </Button>
            </Link>
          )}
          {showDiscord && (
            <Link href="https://discord.gg/2v64p2fzsC" target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                variant="outline"
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white border-[#5865F2] hover:border-[#4752C4]
                          transform hover:scale-105 transition-all duration-300 ease-in-out
                          flex items-center gap-2"
              >
                <Icons.discord className="h-5 w-5" />
                Join Discord
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
