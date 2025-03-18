// src/app/(public)/cell-game/page.tsx
'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MicroscopeIcon } from "lucide-react"
import FloatingCharacter from "@/components/landing/dr-albright"
import CellIdentificationGame from "@/components/games/bone-marrow-quiz"

export default function CellGamePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
        
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            {/* Content */}
            <div className="flex-1 space-y-6 max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold">
                Cell Spotter Challenge
              </h1>
              <p className="text-lg text-muted-foreground">
                Test and improve your bone marrow cell identification skills with this interactive learning game.
                Our carefully curated collection of cell images will help you master the key morphological features 
                that distinguish different cell types.
              </p>
              <div>
                <a href="#game-section">
                  <Button 
                    size="lg" 
                    className="bg-primary hover:bg-primary/90"
                  >
                    Start Playing
                  </Button>
                </a>
              </div>
            </div>

            {/* Character - hidden on mobile */}
            <div className="hidden md:block w-[350px]">
              <FloatingCharacter
                imagePath="/images/dr-albright.png"
                imageAlt="Dr. Albright Character"
                size={350}
                wrapperClassName="w-full flex justify-center"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Game Section */}
      <section id="game-section" className="relative py-16">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container px-4 max-w-6xl mx-auto relative">
          <CellIdentificationGame />
        </div>
      </section>

      {/* Join Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready for More Learning?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Cell Spotter is just one of many learning tools available on PathologyBites.
            Create a free account to access our complete question bank, detailed explanations,
            and track your progress across all subspecialties.
          </p>
          <Link href="/signup">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 transform hover:scale-105 
                        transition-all duration-300 ease-in-out"
            >
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}