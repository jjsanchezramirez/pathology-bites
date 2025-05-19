// src/app/(public)/coming-soon/page.tsx
'use client'

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from '@/hooks/use-toast'
import DemoQuestion from "@/components/landing/demo-question"
import { ScrollToTopButton } from "@/components/landing/scroll-to-top"
import { FeatureCard } from "@/components/landing/feature-card"
import { BookOpenIcon, BarChartIcon, TestTube2Icon } from "lucide-react"
import { CountdownTimer } from "@/components/landing/countdown-timer"
import { useEmailSubscription } from "@/hooks/use-email-subscription"

export default function ComingSoonPage() {
  const { toast } = useToast()
  const {
    email,
    setEmail,
    isSubmitting,
    handleSubmit
  } = useEmailSubscription({
    onSuccess: () => {
      toast({
        description: "Thanks for subscribing! We'll notify you when we launch."
      })
      setEmail('')
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to subscribe. Please try again later."
      })
    }
  })
  
  const scrollToPreview = () => {
    const previewSection = document.getElementById('preview-section')
    if (previewSection) {
      previewSection.scrollIntoView({ behavior: 'smooth' })
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
            onClick={scrollToPreview}
            aria-label="Scroll to preview section"
          >
            <p className="text-sm text-center text-muted-foreground mb-2">See a preview of the site</p>
            <ChevronDown className="h-6 w-6 text-primary mx-auto animate-bounce" />
          </button>
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

      {/* Features Section */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <h2 className="text-center text-4xl font-bold mb-16">
            Transform Your Learning Experience
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <FeatureCard
              icon={BookOpenIcon}
              title="Comprehensive Curriculum"
              description="Expert-curated questions covering all major pathology subspecialties and board exam topics"
            />
            <FeatureCard
              icon={BarChartIcon}
              title="Smart Analytics"
              description="Track your progress with detailed performance analytics and competency heatmaps"
            />
            <FeatureCard
              icon={TestTube2Icon}
              title="Virtual Lab Cases"
              description="Practice with interactive case simulations featuring real histopathology slides"
            />
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