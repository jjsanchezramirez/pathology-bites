// src/app/privacy/page.tsx

import { PublicHero } from "@/shared/components/common/public-hero";
import { PolicyCard } from "@/shared/components/common/policy-card";
import { PublicPageCTA } from "@/shared/components/common/public-page-cta";
import { CookieSettingsButton } from "@/shared/components/common/cookie-consent-banner";

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
            <PolicyCard title="Information We Collect">
              <p>We collect and process the following types of information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Account information (name, email, institution)</li>
                <li>Educational progress data (quiz scores, study patterns)</li>
                <li>Platform usage statistics for improvement</li>
                <li>Technical data required for platform functionality</li>
              </ul>
            </PolicyCard>

            <PolicyCard title="How We Use Your Data">
              <p>We only use your information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and improve our educational services</li>
                <li>Track and analyze your learning progress</li>
                <li>Maintain platform security and performance</li>
                <li>Communicate important updates</li>
              </ul>
            </PolicyCard>

            <PolicyCard title="Data Protection">
              <p>
                All personal information is stored in a secure computing environment protected by
                firewalls and encryption. Access is strictly controlled and limited to essential
                personnel who are bound by confidentiality agreements.
              </p>
              <p>
                We implement industry-standard security measures to protect your data from
                unauthorized access, disclosure, alteration, and destruction.
              </p>
            </PolicyCard>

            <PolicyCard title="Your Rights">
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access and export your personal data</li>
                <li>Request corrections to your information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of non-essential data collection</li>
              </ul>
            </PolicyCard>

            <PolicyCard title="Data Retention">
              <p>
                We retain your data only as long as necessary to provide our services and comply
                with legal obligations. You can request deletion of your account and data at any
                time through your account settings or by contacting support.
              </p>
            </PolicyCard>

            <PolicyCard title="Updates to This Policy">
              <p>
                We may update this privacy policy to reflect changes in our practices or legal
                requirements. We'll notify you of any significant changes via email or through the
                platform.
              </p>
            </PolicyCard>

            <div id="cookies" className="scroll-mt-24">
              <PolicyCard title="Cookies and Analytics">
                <p>We use a small number of cookies:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    Essential cookies that keep you signed in and remember your settings. The site
                    cannot work without them.
                  </li>
                  <li>
                    A first-party cookie that records how you first found the site (for example, a
                    search engine or a link), so we can see which sources bring new members. It is
                    not shared with anyone.
                  </li>
                  <li>
                    Google Analytics cookies, only if you choose Accept in the cookie banner. They
                    tell us which pages are used so we can improve them. If you decline, Google
                    Analytics is not loaded.
                  </li>
                </ul>
                <p>
                  We also use Vercel Analytics, which counts page visits without cookies. You can
                  change your choice at any time:{" "}
                  <CookieSettingsButton className="text-primary hover:underline font-medium" />.
                </p>
              </PolicyCard>
            </div>

            <PolicyCard title="Third-Party Websites">
              <p>
                PathologyBites may provide links to third-party websites, including educational
                repositories, virtual slide collections, and other external resources. We are not
                responsible for the privacy practices, content, or security of these external
                websites.
              </p>
              <p>
                When you access third-party websites through our platform, you are subject to their
                respective privacy policies and terms of service. We encourage you to review the
                privacy policies of any external websites you visit through our links.
              </p>
              <p>
                We do not control, endorse, or assume responsibility for the content, privacy
                policies, or practices of any third-party websites or services.
              </p>
            </PolicyCard>
          </div>
        </div>
      </section>

      {/* Spacer to push contact section to bottom */}
      <div className="flex-1" />

      {/* Contact Section */}
      <PublicPageCTA
        title="Questions About Privacy?"
        description="We're committed to protecting your privacy and are happy to answer any questions. Feel free to reach out using our contact form below."
        buttonText="Contact Us"
        buttonHref="/contact"
      />
    </div>
  );
}
