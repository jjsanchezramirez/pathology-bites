// src/app/(public)/contact/page.tsx
'use client'

import { PublicHero } from "@/shared/components/common/public-hero"
import { ContactForm } from "@/shared/components/common/contact-form"
import { JoinCommunitySection } from "@/shared/components/common/join-community-section"

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Contact Us"
        description="Have questions about PathologyBites? We're here to help! Fill out the form below and we'll get back to you as soon as possible."
      />

      {/* Contact Form Section */}
      <ContactForm />

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community */}
      <JoinCommunitySection
        description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone."
      />
    </div>
  )
}