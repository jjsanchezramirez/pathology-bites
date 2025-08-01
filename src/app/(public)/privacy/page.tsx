// src/app/privacy/page.tsx
'use client'

import { Button } from "@/shared/components/ui/button"
import Link from "next/link"
import { Card } from "@/shared/components/ui/card"
import { PublicHero } from "@/shared/components/common/public-hero"

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Privacy Policy"
        description="PathologyBites is committed to protecting your personal information. This policy outlines our practices for collecting, using, and safeguarding your data while providing exceptional pathology education."
      />

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

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Third-Party Websites</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  PathologyBites may provide links to third-party websites, including educational repositories,
                  virtual slide collections, and other external resources. We are not responsible for the
                  privacy practices, content, or security of these external websites.
                </p>
                <p>
                  When you access third-party websites through our platform, you are subject to their respective
                  privacy policies and terms of service. We encourage you to review the privacy policies of any
                  external websites you visit through our links.
                </p>
                <p>
                  We do not control, endorse, or assume responsibility for the content, privacy policies, or
                  practices of any third-party websites or services.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Spacer to push contact section to bottom */}
      <div className="flex-1" />

      {/* Contact Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
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