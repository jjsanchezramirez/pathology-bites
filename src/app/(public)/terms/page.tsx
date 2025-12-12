// src/app/terms/page.tsx
'use client'

import { PublicHero } from "@/shared/components/common/public-hero"
import { PolicyCard } from "@/shared/components/common/policy-card"
import { PublicPageCTA } from "@/shared/components/common/public-page-cta"

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Terms of Use"
        description="Please read these terms carefully before using PathologyBites. By accessing or using our platform, you agree to be bound by these terms and conditions."
      />

      {/* Agreement Banner */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-linear-to-b from-primary/90 to-primary" />
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
            <PolicyCard title="General Terms">
              <p>
                PathologyBites is an online educational service provided subject to your compliance
                with these terms and conditions. We reserve the right to modify these terms at our
                sole discretion. Continued use of the platform after any modifications indicates
                your acceptance of the updated terms.
              </p>
            </PolicyCard>

            <PolicyCard title="Disclaimer of Warranties">
              <p>Our platform and its contents are provided "as is" without any warranties of any kind, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Merchantability</li>
                <li>Fitness for a particular purpose</li>
                <li>Non-infringement</li>
                <li>Accuracy or completeness of content</li>
              </ul>
            </PolicyCard>

            <PolicyCard title="Intellectual Property">
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
            </PolicyCard>

            <PolicyCard title="User Responsibilities">
              <p>You agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate registration information</li>
                <li>Maintain the security of your account</li>
                <li>Use the platform for its intended educational purpose</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </PolicyCard>

            <PolicyCard title="Limitation of Liability">
              <p>
                PathologyBites will not be liable for any damages arising from the use or inability
                to use our platform, including but not limited to direct, indirect, incidental,
                punitive, and consequential damages.
              </p>
            </PolicyCard>

            <PolicyCard title="Governing Law">
              <p>
                These terms shall be governed by and construed in accordance with the laws of the
                state of Delaware, United States of America, without regard to its conflict of
                law provisions.
              </p>
            </PolicyCard>

            <PolicyCard title="Third-Party Content Disclaimer">
              <p>
                Our Virtual Slide Search Engine provides links to third-party whole slide image (WSI) repositories.
                We do not host, store, or claim ownership of any of the content linked. All copyrights remain with
                the respective content owners. Accessing and using external content is subject to each source's
                terms and conditions. No affiliation or endorsement is implied.
              </p>
            </PolicyCard>

            <PolicyCard title="Medical Disclaimer">
              <p>
                PathologyBites is an educational platform intended for learning purposes only and does not
                constitute medical advice, diagnosis, or treatment recommendations. The content provided should
                not be used as a substitute for professional medical judgment or clinical decision-making.
                Always consult qualified healthcare professionals for medical decisions, patient care, and
                diagnostic interpretations.
              </p>
            </PolicyCard>
          </div>
        </div>
      </section>

      {/* Spacer to push contact section to bottom */}
      <div className="flex-1" />

      {/* Contact Section */}
      <PublicPageCTA
        title="Questions About Our Terms?"
        description="If you have any questions about these terms of use, please don't hesitate to contact us. We're here to help clarify any concerns."
        buttonText="Contact Us"
        buttonHref="/contact"
      />
    </div>
  )
}