// src/app/privacy/page.tsx
'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import FloatingCharacter from "@/components/landing/dr-albright"

export default function PrivacyPage() {
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
                Privacy Policy
              </h1>
              <p className="text-lg text-muted-foreground">
                PathologyBites is committed to protecting your personal information. This policy outlines our 
                practices for collecting, using, and safeguarding your data while providing exceptional 
                pathology education.
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

      {/* Main Content */}
      <section className="py-16 relative">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto space-y-8">
            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Information We Collect</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>We collect and process the following types of information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Account information (name, email, institution)</li>
                  <li>Educational progress data (quiz scores, study patterns)</li>
                  <li>Platform usage statistics for improvement</li>
                  <li>Technical data required for platform functionality</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">How We Use Your Data</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>We only use your information to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide and improve our educational services</li>
                  <li>Track and analyze your learning progress</li>
                  <li>Maintain platform security and performance</li>
                  <li>Communicate important updates</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Data Protection</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  All personal information is stored in a secure computing environment protected by firewalls 
                  and encryption. Access is strictly controlled and limited to essential personnel who are 
                  bound by confidentiality agreements.
                </p>
                <p>
                  We implement industry-standard security measures to protect your data from unauthorized 
                  access, disclosure, alteration, and destruction.
                </p>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Your Rights</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>You have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access and export your personal data</li>
                  <li>Request corrections to your information</li>
                  <li>Delete your account and associated data</li>
                  <li>Opt out of non-essential data collection</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Data Retention</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  We retain your data only as long as necessary to provide our services and comply 
                  with legal obligations. You can request deletion of your account and data at any 
                  time through your account settings or by contacting support.
                </p>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Updates to This Policy</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  We may update this privacy policy to reflect changes in our practices or legal 
                  requirements. We'll notify you of any significant changes via email or through 
                  the platform.
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
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Questions About Privacy?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            We're committed to protecting your privacy and are happy to answer any questions. 
            Feel free to reach out using our contact form below.
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