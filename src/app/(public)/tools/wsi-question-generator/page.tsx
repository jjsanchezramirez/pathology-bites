'use client'

import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import Link from 'next/link'
import { Microscope, ArrowRight, Lock, Sparkles } from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'

export default function WSIQuestionsPage() {
  return (
    <>
      <PublicHero
        title="Digital Slides Questions"
        subtitle="AI-Powered Virtual Slide Learning"
        description="Practice with AI-generated questions based on real virtual slide images and educational content"
        icon={Microscope}
      />

      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Main Message Card */}
            <Card className="border-2 border-primary/20 shadow-lg">
              <CardContent className="p-8 md:p-12">
                <div className="text-center space-y-6">
                  {/* Icon */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                      <div className="relative bg-primary/10 p-6 rounded-full">
                        <Lock className="h-12 w-12 text-primary" />
                      </div>
                    </div>
                  </div>

                  {/* Heading */}
                  <div className="space-y-3">
                    <h2 className="text-3xl md:text-4xl font-bold">
                      Tools Have Moved!
                    </h2>
                    <p className="text-xl text-muted-foreground">
                      Digital Slides Questions is now part of our authenticated learning platform
                    </p>
                  </div>

                  {/* Description */}
                  <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                    <p className="text-lg leading-relaxed">
                      To provide you with a better learning experience and personalized features, 
                      our Digital Slides Questions tool is now available exclusively to registered users.
                    </p>
                    <div className="flex items-start gap-3 text-left">
                      <Sparkles className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">Good news:</strong> Creating an account is 
                        completely free and gives you access to all our interactive learning tools, 
                        progress tracking, and personalized study features.
                      </p>
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                    <Link href="/signup" className="flex-1 sm:flex-initial">
                      <Button 
                        size="lg" 
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-8 group"
                      >
                        Create Free Account
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <Link href="/login" className="flex-1 sm:flex-initial">
                      <Button 
                        size="lg" 
                        variant="outline"
                        className="w-full sm:w-auto px-8"
                      >
                        Sign In
                      </Button>
                    </Link>
                  </div>

                  {/* Trust Indicator */}
                  <p className="text-sm text-muted-foreground pt-4">
                    100% Free • No Credit Card Required • Instant Access
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Features Preview */}
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <Card className="border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Microscope className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">AI-Generated Questions</h3>
                  <p className="text-sm text-muted-foreground">
                    Practice with questions generated from real virtual slide images
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Personalized Learning</h3>
                  <p className="text-sm text-muted-foreground">
                    Track your progress and get personalized recommendations
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardContent className="p-6 text-center">
                  <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ArrowRight className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Instant Access</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign up in seconds and start learning immediately
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <JoinCommunitySection />
    </>
  )
}

