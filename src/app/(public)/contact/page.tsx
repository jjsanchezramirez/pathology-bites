// src/app/(public)/contact/page.tsx
'use client'

import { useState } from 'react'
import { Button } from "@/shared/components/ui/button"
import { Card } from "@/shared/components/ui/card"
import { Label } from "@/shared/components/ui/label"
import { Input } from "@/shared/components/ui/input"
import { Textarea } from "@/shared/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group"
import { PublicHero } from "@/shared/components/common/public-hero"
import { toast } from 'sonner'
import { Icons } from "@/shared/components/common/icons"
import { submitContactForm } from '@/app/api/contact/contact'
import { JoinCommunitySection } from "@/shared/components/common/join-community-section"

type FormData = {
  requestType: 'technical' | 'general'
  firstName: string
  lastName: string
  organization: string
  email: string
  inquiry: string
}

type FormErrors = {
  [K in keyof FormData]?: string
}

// Update the interface to match Zod's error structure
interface ZodIssue {
  path: (string | number)[]  // This is the correct type for Zod path
  message: string
  // Other Zod issue properties can be included if needed
}

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formData, setFormData] = useState<FormData>({
    requestType: 'general',
    firstName: '',
    lastName: '',
    organization: '',
    email: '',
    inquiry: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})
    console.log('Form submitted:', formData)

    try {
      const result = await submitContactForm(formData)
      console.log('Submission result:', result)

      if (result.success) {
        toast.success("Thanks for reaching out! We'll get back to you soon.")

        // Reset form
        setFormData({
          requestType: 'general',
          firstName: '',
          lastName: '',
          organization: '',
          email: '',
          inquiry: ''
        })
      } else {
        if (result.details && Array.isArray(result.details)) {
          // Handle Zod validation errors - fix the type here
          const newErrors: FormErrors = {}
          result.details.forEach((error: ZodIssue) => {
            // Safely handle the path - it could be a string or number
            const pathSegment = error.path[0]
            const path = String(pathSegment) // Convert to string regardless of type
            newErrors[path as keyof FormData] = error.message
          })
          setErrors(newErrors)

          toast.error("Please check the form for errors.")
        } else {
          toast.error(result.error || 'Something went wrong. Please try again.')
        }
        console.error('Submission error:', result)
      }
    } catch (error) {
      console.error('Form submission error:', error)
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Type for Radio Group Value Change Event
  type RadioChangeEvent = {
    target: {
      name: string;
      value: 'technical' | 'general';
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | RadioChangeEvent
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error for this field when user starts typing
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }))
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Contact Us"
        description="Have questions about PathologyBites? We're here to help! Fill out the form below and we'll get back to you as soon as possible."
      />

      {/* Contact Form Section */}
      <section className="py-16 relative">
        <div className="container px-4 mx-auto">
          <Card className="max-w-2xl mx-auto p-8 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Request Type */}
              <div className="space-y-4">
                <Label>Request Type</Label>
                <RadioGroup
                  name="requestType"
                  value={formData.requestType}
                  onValueChange={(value) => handleChange({ target: { name: 'requestType', value } } as RadioChangeEvent)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="technical" id="technical" />
                    <Label htmlFor="technical">Technical Support</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="general" id="general" />
                    <Label htmlFor="general">General Inquiry</Label>
                  </div>
                </RadioGroup>
                {errors.requestType && (
                  <p className="text-sm text-destructive">{errors.requestType}</p>
                )}
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className={errors.firstName ? "border-destructive" : ""}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className={errors.lastName ? "border-destructive" : ""}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Organization - Optional */}
              <div className="space-y-2">
                <Label htmlFor="organization">
                  Organization <span className="text-sm text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="organization"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  className={errors.organization ? "border-destructive" : ""}
                />
                {errors.organization && (
                  <p className="text-sm text-destructive">{errors.organization}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Inquiry */}
              <div className="space-y-2">
                <Label htmlFor="inquiry">
                  Your inquiry 
                  <span className="text-sm text-muted-foreground ml-2">(Minimum 10 characters)</span>
                </Label>
                <Textarea
                  id="inquiry"
                  name="inquiry"
                  value={formData.inquiry}
                  onChange={handleChange}
                  required
                  className={`min-h-[150px] ${errors.inquiry ? "border-destructive" : ""}`}
                />
                {errors.inquiry && (
                  <p className="text-sm text-destructive">{errors.inquiry}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </Button>
            </form>
          </Card>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community */}
      <JoinCommunitySection
        description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone."
      />
    </div>
  )
}