// src/app/(public)/contact/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PublicHero } from "@/shared/components/common/public-hero";
import { ContactForm } from "@/shared/components/common/contact-form";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { ScrollReveal } from "@/shared/components/common/scroll-reveal";

function ContactPageContent() {
  const searchParams = useSearchParams();

  // Get prefill values from query params
  const prefillType = searchParams.get("type") as "technical" | "general" | null;
  const prefillSubject = searchParams.get("subject");
  const prefillMessage = searchParams.get("message");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Contact Us"
        description="Have questions about PathologyBites? We're here to help! Fill out the form below and we'll get back to you as soon as possible."
      />

      {/* Contact Form Section */}
      <ScrollReveal animation="scale-in">
        <ContactForm
          prefillType={prefillType}
          prefillSubject={prefillSubject}
          prefillMessage={prefillMessage}
        />
      </ScrollReveal>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community */}
      <ScrollReveal animation="fade-up">
        <JoinCommunitySection description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone." />
      </ScrollReveal>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContactPageContent />
    </Suspense>
  );
}
