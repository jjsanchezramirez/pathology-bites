// src/app/(public)/coming-soon/page.tsx
'use client'

import { ChevronDown } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { toast } from 'sonner'
import DemoQuestion from "@/shared/components/common/demo-question"
import { ScrollToTopButton } from "@/shared/components/common/scroll-to-top"
import { CountdownTimer } from "@/shared/components/common/countdown-timer"
import { useEmailSubscription } from "@/shared/hooks/use-email-subscription"
import { usePublicStats } from "@/shared/hooks/use-public-stats"
import Link from "next/link"

export default function ComingSoonPage() {
  const {
    email,
    setEmail,
    isSubmitting,
    handleSubmit
  } = useEmailSubscription({
    onSuccess: () => {
      toast.success("Thanks for subscribing! We'll notify you when we launch.")
      setEmail('')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to subscribe. Please try again later.")
    }
  })

  const { stats, loading: statsLoading } = usePublicStats()
  
  const scrollToNext = () => {
    const nextSection = document.getElementById('learn-more-section')
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: 'smooth' })
    }
  }
  
  return (
    <main className="relative flex flex-col">
      {/* Hero/Coming Soon Section - Full Screen */}
      <section className="relative min-h-screen flex flex-col items-center justify-center py-24">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.12),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />
        
        {/* Main Content */}
        <div className="container mx-auto px-6 max-w-6xl z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
            {/* Left Column - Content */}
            <div className="w-full lg:w-3/5 space-y-6 text-center lg:text-left">
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold">
                Our website is{" "}
                <span className="bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
                  under construction
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
                We're working hard to bring you a new pathology learning platform. 
                Stay tuned for our official launch on August 1st, 2025.
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
                      aria-label="Subscribe for launch notification"
                    >
                      {isSubmitting ? "..." : "Notify Me"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
            
            {/* Right Column - Countdown */}
            <div className="w-full lg:w-2/5">
              <CountdownTimer launchDateStr={process.env.NEXT_PUBLIC_LAUNCH_DATE || '2025-08-01'} />
            </div>
          </div>
          
          {/* Scroll Indicator */}
          <button
            className="absolute bottom-8 left-0 right-0 cursor-pointer flex flex-col items-center"
            onClick={scrollToNext}
            aria-label="Scroll to next section"
          >
            <p className="text-sm text-center text-muted-foreground mb-2">Learn more about Pathology Bites</p>
            <ChevronDown className="h-6 w-6 text-primary mx-auto animate-bounce" />
          </button>
        </div>
      </section>

      {/* Navigation Section */}
      <section id="learn-more-section" className="relative py-16 border-t bg-gradient-to-b from-primary/10 via-primary/5 to-background">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-2xl font-bold mb-8">Learn More About Pathology Bites</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              href="/about"
              className="p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-primary/20 hover:bg-white/80 hover:border-primary/40 hover:shadow-lg transition-all duration-300 text-center group"
            >
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">About</div>
              <div className="text-sm text-muted-foreground mt-2">Our mission</div>
            </Link>
            <Link
              href="/contact"
              className="p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-primary/20 hover:bg-white/80 hover:border-primary/40 hover:shadow-lg transition-all duration-300 text-center group"
            >
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Contact</div>
              <div className="text-sm text-muted-foreground mt-2">Get in touch</div>
            </Link>
            <Link
              href="/faq"
              className="p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-primary/20 hover:bg-white/80 hover:border-primary/40 hover:shadow-lg transition-all duration-300 text-center group"
            >
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">FAQ</div>
              <div className="text-sm text-muted-foreground mt-2">Common questions</div>
            </Link>
            <Link
              href="/terms"
              className="p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-primary/20 hover:bg-white/80 hover:border-primary/40 hover:shadow-lg transition-all duration-300 text-center group"
            >
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Terms</div>
              <div className="text-sm text-muted-foreground mt-2">Terms of service</div>
            </Link>
            <Link
              href="/privacy"
              className="p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-primary/20 hover:bg-white/80 hover:border-primary/40 hover:shadow-lg transition-all duration-300 text-center group"
            >
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Privacy</div>
              <div className="text-sm text-muted-foreground mt-2">Privacy policy</div>
            </Link>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section id="preview-section" className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Preview Our Interactive Learning
            </h2>
            <p className="text-xl text-muted-foreground">
              Pathology Bites will feature hundreds of high-quality questions to test and enhance your knowledge. 
              Here's a sample from our question bank:
            </p>
          </div>
          <DemoQuestion />
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-16">
        <div className="container mx-auto px-4 relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Questions Ready */}
            <div className="text-center group">
              <div className="relative">
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                  {statsLoading ? '...' : stats.questions.toLocaleString()}
                </div>
                <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="text-lg font-semibold text-foreground mb-1">Questions Ready</div>
              <div className="text-sm text-muted-foreground">High-yield pathology content</div>
            </div>

            {/* Images */}
            <div className="text-center group">
              <div className="relative">
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                  {statsLoading ? '...' : stats.images.toLocaleString()}
                </div>
                <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="text-lg font-semibold text-foreground mb-1">Images</div>
              <div className="text-sm text-muted-foreground">High-resolution pathology images</div>
            </div>

            {/* Categories */}
            <div className="text-center group">
              <div className="relative">
                <div className="text-5xl md:text-6xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                  {statsLoading ? '...' : stats.categories}
                </div>
                <div className="absolute -inset-4 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="text-lg font-semibold text-foreground mb-1">Categories</div>
              <div className="text-sm text-muted-foreground">Complete subspecialty coverage</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-tr from-primary-foreground/10 to-transparent" />
        <div className="container mx-auto px-4 py-24 relative">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Get Notified When We Launch
            </h2>
            <p className="text-lg text-primary-foreground/90">
              Be the first to know when Pathology Bites goes live. Subscribe to receive launch updates.
            </p>
            <div className="pt-4">
              <Button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 px-8
                  transform hover:scale-105 active:scale-95 
                  hover:shadow-xl hover:shadow-white/10
                  transition-all duration-300 ease-in-out 
                  relative overflow-hidden"
                aria-label="Scroll to top to subscribe"
              >
                Subscribe Now
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Scroll to top button */}
      <ScrollToTopButton />
    </main>
  )
}