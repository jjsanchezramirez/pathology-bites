// src/features/dashboard/components/feature-placeholder.tsx
'use client'

import { Button } from '@/shared/components/ui/button'
import { Construction, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface FeaturePlaceholderProps {
  title: string
  description: string
  status: 'launching-soon' | 'coming-very-soon' | 'almost-ready' | 'in-final-stages'
  discordUrl?: string
}

export function FeaturePlaceholder({
  title,
  description,
  discordUrl = 'https://discord.gg/2v64p2fzsC',
}: FeaturePlaceholderProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-start justify-center px-4 pt-32">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Icon */}
        <Construction className="h-16 w-16 mx-auto" style={{ color: 'var(--color-accent)' }} />

        {/* Title & Description */}
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-2">
          <Link href={discordUrl} target="_blank" rel="noopener noreferrer">
            <Button
              size="lg"
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white w-full
                transition-all duration-200 flex items-center justify-center gap-2"
              aria-label="Join our Discord community"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.3671a19.8062 19.8062 0 00-4.8851-1.5152.074.074 0 00-.0787.0366c-.211.3667-.4429.8458-.6052 1.2259a18.27 18.27 0 00-5.487 0c-.1623-.3801-.3957-.8592-.6052-1.2259a.077.077 0 00-.0787-.0366 19.7892 19.7892 0 00-4.8854 1.515.07.07 0 00-.0313.0273C.5033 9.09.1819 13.7381 1.0139 18.2982a.08.08 0 00.0311.0269c1.7164.8034 3.388 1.2897 5.0328 1.6117a.079.079 0 00.0855-.028c.462-.6304.873-1.2952 1.226-1.9885a.076.076 0 00-.0422-.1061 12.646 12.646 0 01-1.8062-.8637.077.077 0 01-.0076-.1277c.1214-.0912.2432-.1858.3617-.2818a.073.073 0 01.0756-.0093c3.928 1.7953 8.199 1.7953 12.067 0a.073.073 0 01.0757.0093c.1185.096.2403.1906.3617.2818a.077.077 0 01-.0075.1279 12.604 12.604 0 01-1.8062.8637.077.077 0 00-.0422.1061c.353.6933.764 1.3581 1.226 1.9885a.076.076 0 00.0855.028 19.892 19.892 0 005.0328-1.6117.077.077 0 00.0313-.027c.9181-4.9808.3899-9.3007-1.6507-13.1519a.061.061 0 00-.0313-.0273zM8.02 15.3312c-1.1825 0-2.1569-.9718-2.1569-2.1771 0-1.2052.9518-2.1771 2.1569-2.1771 1.2051 0 2.1569.9719 2.1569 2.1771 0 1.2053-.9518 2.1771-2.1569 2.1771zm7.9748 0c-1.1825 0-2.1569-.9718-2.1569-2.1771 0-1.2052.9518-2.1771 2.1569-2.1771 1.2051 0 2.1569.9719 2.1569 2.1771 0 1.2053-.9518 2.1771-2.1569 2.1771z" />
              </svg>
              Join Discord
            </Button>
          </Link>
          <Button
            size="lg"
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 hover:bg-accent/10"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

