// src/app/faq/page.tsx
'use client'

import { Button } from "@/shared/components/ui/button"
import Link from "next/link"
import { PublicHero } from "@/shared/components/common/public-hero"
import { FAQCategory } from "@/shared/components/common/faq-category"
import { PublicPageCTA } from "@/shared/components/common/public-page-cta"
import { faqData } from "@/shared/data/faq-data"

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Frequently Asked Questions"
        description="Find answers to common questions about PathologyBites. Can't find what you're looking for? Feel free to contact us."
        actions={
          <div className="flex gap-4 pt-2">
            <Link href="/contact">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Contact Us
              </Button>
            </Link>
          </div>
        }
      />

      {/* FAQ Categories */}
      <section className="relative py-16">
        <div className="container px-4 mx-auto max-w-4xl">
          {faqData.map((category, index) => (
            <FAQCategory key={index} category={category} />
          ))}
        </div>
      </section>

      {/* Spacer to push contact section to bottom */}
      <div className="flex-1" />

      {/* Contact Section */}
      <PublicPageCTA
        title="Still Have Questions?"
        description="Can't find the answer you're looking for? We're here to help! Reach out to us through our contact form."
        buttonText="Contact Us"
        buttonHref="/contact"
      />
    </div>
  )
}