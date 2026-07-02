// src/app/(public)/contact/page.tsx
import { PublicHero } from "@/shared/components/common/public-hero";
import { ContactForm } from "@/shared/components/common/contact-form";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { ScrollReveal } from "@/shared/components/common/scroll-reveal";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; subject?: string; message?: string }>;
}) {
  // Get prefill values from query params
  const params = await searchParams;
  const prefillType = params.type === "technical" || params.type === "general" ? params.type : null;
  const prefillSubject = params.subject ?? null;
  const prefillMessage = params.message ?? null;

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
