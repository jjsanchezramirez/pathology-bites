// src/app/(public)/maintenance/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { useMaintenanceNotifications } from "@/shared/hooks/use-maintenance-notifications"
import { toast } from 'sonner'
import FloatingCharacter from "@/shared/components/common/dr-albright"
import { getR2PublicUrl } from "@/shared/services/r2-storage"
import Link from "next/link"

export default function MaintenancePage() {
  const router = useRouter()
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isProduction = process.env.NODE_ENV === 'production'

  // In production, redirect to 404 if maintenance mode is not enabled
  useEffect(() => {
    if (isProduction && !isMaintenanceMode) {
      router.replace('/not-found')
    }
  }, [isProduction, isMaintenanceMode, router])

  const {
    email,
    setEmail,
    isSubmitting,
    handleSubmit
  } = useMaintenanceNotifications({
    onSuccess: () => {
      toast.success("Thanks! We'll notify you when we're back online.")
      setEmail('')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to subscribe. Please try again later.")
    }
  })

  // Don't render anything while redirecting
  if (isProduction && !isMaintenanceMode) {
    return null
  }

  return (
    <main className="relative flex flex-col">
      {/* Hero/Maintenance Section */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.12),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] animate-gradient" />

        {/* Main Content */}
        <div className="container mx-auto px-6 max-w-6xl z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
            {/* Left Column - Content */}
            <div className="w-full lg:w-3/5 space-y-6 text-center lg:text-left">
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold">
                We're currently{" "}
                <span className="bg-linear-to-r bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
                  upgrading our site
                </span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                We're performing scheduled maintenance to improve your experience.
                Get notified when we're back online.
              </p>

              {/* Subscription Form */}
              <div className="mt-8">
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto lg:mx-0">
                  <div className="flex items-center rounded-full bg-white p-2 pl-4 shadow-xs border border-gray-100 grow">
                    <span className="sr-only">
                      <Label htmlFor="email-input">Email address</Label>
                    </span>
                    <svg
                      className="w-5 h-5 text-muted-foreground mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <Input
                      id="email-input"
                      type="email"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm grow"
                      aria-label="Email address"
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full px-6 bg-primary hover:bg-primary/90 text-white"
                      aria-label="Subscribe for maintenance notification"
                    >
                      {isSubmitting ? "..." : "Notify Me"}
                    </Button>
                  </div>
                </form>
              </div>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                We'll be back soon! In the meantime, why not...
              </p>

              {/* Discord Button - Centered on mobile, left-aligned on desktop */}
              <div className="mt-6 flex justify-center lg:justify-start">
                <Link href="https://discord.gg/2v64p2fzsC" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-8
                      transform hover:scale-105 active:scale-95
                      hover:shadow-xl hover:shadow-[#5865F2]/20
                      transition-all duration-300 ease-in-out
                      relative overflow-hidden flex items-center gap-2"
                    aria-label="Join our Discord community"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Join Our Discord
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column - Dr. Albright (Hidden on mobile) */}
            <div className="hidden lg:block w-full lg:w-2/5">
              <FloatingCharacter
                imagePath={getR2PublicUrl("assets/dr-albright.png")}
                imageAlt="Dr. Albright Character"
                size={400}
                wrapperClassName="w-full flex justify-center"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
