// src/app/faq/page.tsx
'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import FloatingCharacter from "@/components/landing/dr-albright"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px] opacity-[0.15]" />
        
        <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex items-center justify-between gap-8">
            {/* Content */}
            <div className="flex-1 space-y-6 max-w-2xl">
                <h1 className="text-3xl md:text-5xl font-bold">
                Frequently Asked Questions
                </h1>
                <p className="text-lg text-muted-foreground">
                Find answers to common questions about PathologyBites. Can't find what you're 
                looking for? Feel free to contact us.
                </p>
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

      {/* FAQ Categories */}
      <section className="relative py-16">
        <div className="container px-4 mx-auto max-w-4xl">
          {/* General */}
          <Card className="p-8 shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6">General</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="what-is">
                <AccordionTrigger className="text-left">What is PathologyBites?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  A completely FREE pathology education platform powered by AI, offering 
                  a comprehensive question bank and learning tools for pathology education.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="who-for">
                <AccordionTrigger className="text-left">Who is PathologyBites for?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Medical students, residents, fellows, and practicing pathologists looking to 
                  enhance their knowledge.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="email-req">
                <AccordionTrigger className="text-left">Do I need an institutional email to sign up?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  No! You can sign up with any email address. We do require an email to
                    track your progress and provide personalized recommendations.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Content & Quality */}
          <Card className="p-8 shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6">Content & Quality</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="content-generation">
                <AccordionTrigger className="text-left">How is your content generated?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <p className="mb-4">
                    Our questions are generated through an advanced AI large language model (LLM) 
                    specifically trained on comprehensive pathology literature, including peer-reviewed 
                    journals and authoritative texts. We strictly adhere to the American Board of 
                    Pathology (ABP) AP/CP Board Exam content specifications to ensure our material 
                    covers all high-yield topics.
                  </p>
                  <p>
                    Every piece of content undergoes rigorous verification by our expert pathology 
                    faculty before publication. This innovative AI-driven approach, combined with 
                    expert oversight, enables us to maintain exceptional educational quality while 
                    keeping PathologyBites completely free for all users.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="images">
                <AccordionTrigger className="text-left">What about the photographs and diagrams?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <p className="mb-4">
                    We use high-quality images from our own collection and trusted sources like 
                    PathologyOutlines and Wikimedia Commons. All sources are clearly credited 
                    alongside each image.
                  </p>
                  <p>
                    Feel free to use any content from PathologyBites for educational purposes, as long 
                    as proper attribution is provided. We believe in open education and knowledge sharing 
                    within the pathology community.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="updates">
                <AccordionTrigger className="text-left">How often is content updated?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  We regularly revise questions based on user feedback and updates in the field. We 
                  greatly appreciate user feedback to help maintain content accuracy and relevance.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Technical & Support */}
          <Card className="p-8 shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6">Technical & Support</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="mobile">
                <AccordionTrigger className="text-left">Can I use PathologyBites on mobile devices?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Coming soon! We're developing native mobile apps for both Android and iOS devices. 
                  In the meantime, you can access PathologyBites through your mobile browser for a 
                  fully responsive experience.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="progress">
                <AccordionTrigger className="text-left">Is my progress saved if I lose internet connection?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Yes, all progress is automatically saved and syncs when your connection resumes.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="feedback">
                <AccordionTrigger className="text-left">How can I report issues or suggest improvements?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Through our contact form. We value your feedback and use it to continuously improve 
                  the platform.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Institutional */}
          <Card className="p-8 shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6">Institutional</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="partnership">
                <AccordionTrigger className="text-left">Can my institution partner with PathologyBites?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  We're excited to partner with institutions! Contact us to discuss how we can 
                  work together to support your educational goals.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="analytics">
                <AccordionTrigger className="text-left">Are institutional analytics available?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  <p className="mb-4">
                    For interested institutions, we offer comprehensive analytics features that allow program 
                    directors to:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Track resident performance and progress across all pathology domains</li>
                    <li>Identify knowledge gaps at individual and group levels</li>
                    <li>Monitor study patterns and engagement metrics</li>
                    <li>Generate detailed reports for competency assessments</li>
                    <li>Compare anonymous aggregate data with national benchmarks</li>
                  </ul>
                  <p className="mt-4">
                    Contact us to learn more about implementing these features for your program.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Cost & Participation */}
          <Card className="p-8 shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6">Cost & Participation</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="cost">
                <AccordionTrigger className="text-left">Is PathologyBites really free?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Yes! PathologyBites is completely free. Our AI-powered approach allows us to maintain 
                  high quality while eliminating costs. If you're interested in contributing or 
                  participating in our development, please reach out.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Study Strategy */}
          <Card className="p-8 shadow-lg mb-8">
            <h2 className="text-2xl font-bold mb-6">Study Strategy</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="board-prep">
                <AccordionTrigger className="text-left">How should I use PathologyBites to prepare for boards?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                    <div className="space-y-4">
                        <p>We recommend a systematic approach:</p>
                        <ul className="list-decimal pl-6 space-y-2">
                            <li>Take a general practice test to identify knowledge gaps</li>
                            <li>Focus on weak areas using our targeted quizzes</li>
                            <li>Practice daily, even if only for a few minutes</li>
                            <li>Review explanations thoroughly, even for correct answers</li>
                            <li>Review wrong answers and take notes on key concepts</li>
                            <li>Track your progress with our analytics dashboard</li>
                            <li>Join our Discord group!</li>
                        </ul>
                        <p>
                            Remember: Consistent practice over time is more effective than cramming.
                        </p>
                    </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Still Have Questions?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Can't find the answer you're looking for? We're here to help! Reach out to us 
            through our contact form.
          </p>
          <Link href="/contact">
            <Button 
              size="lg" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 transform hover:scale-105 
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