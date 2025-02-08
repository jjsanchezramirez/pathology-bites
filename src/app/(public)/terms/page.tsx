// src/app/terms/page.tsx
'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import FloatingCharacter from "@/components/landing/dr-albright"

export default function TermsPage() {
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
                Terms of Use
              </h1>
              <p className="text-lg text-muted-foreground">
                Please read these terms carefully before using PathologyBites. By accessing or using our platform, 
                you agree to be bound by these terms and conditions.
              </p>
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

      {/* Agreement Banner */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/90 to-primary" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Agreement to Terms</h2>
          <p className="text-xl mb-8 leading-relaxed text-white/90">
            By using PathologyBites, you acknowledge that you have read, understood, and agree to be bound by 
            these terms. If you do not agree with any part of these terms, please do not use our platform.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 relative">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto space-y-8">
            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">General Terms</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  PathologyBites is an online educational service provided subject to your compliance 
                  with these terms and conditions. We reserve the right to modify these terms at our 
                  sole discretion. Continued use of the platform after any modifications indicates 
                  your acceptance of the updated terms.
                </p>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Disclaimer of Warranties</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>Our platform and its contents are provided "as is" without any warranties of any kind, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Merchantability</li>
                  <li>Fitness for a particular purpose</li>
                  <li>Non-infringement</li>
                  <li>Accuracy or completeness of content</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Intellectual Property</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  All content on PathologyBites is protected by copyright and other intellectual property 
                  rights. You may download material for personal, non-commercial use only, while 
                  maintaining all copyright notices and identifying information.
                </p>
                <p>
                  Our trademarks and logos are registered and unregistered trademarks of PathologyBites. 
                  Nothing on our platform should be construed as granting any license to use these 
                  trademarks.
                </p>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">User Responsibilities</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>You agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide accurate registration information</li>
                  <li>Maintain the security of your account</li>
                  <li>Use the platform for its intended educational purpose</li>
                  <li>Comply with all applicable laws and regulations</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Limitation of Liability</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  PathologyBites will not be liable for any damages arising from the use or inability 
                  to use our platform, including but not limited to direct, indirect, incidental, 
                  punitive, and consequential damages.
                </p>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Governing Law</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  These terms shall be governed by and construed in accordance with the laws of the 
                  state of Delaware, United States of America, without regard to its conflict of 
                  law provisions.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Questions About Our Terms?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            If you have any questions about these terms of use, please don't hesitate to contact us. 
            We're here to help clarify any concerns.
          </p>
          <Link href="/contact">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 transform hover:scale-105 
                        transition-all duration-300 ease-in-out"
            >
              Contact Us
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}