// src/app/(public)/contact/page.tsx
'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import FloatingCharacter from "@/components/landing/dr-albright"
import { useToast } from "@/hooks/use-toast"
import { Icons } from "@/components/theme/icons"
import { submitContactForm } from '@/app/api/contact/contact'

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
  const { toast } = useToast()
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
        toast({
          title: "Message Sent",
          description: "Thanks for reaching out! We'll get back to you soon.",
          duration: 5000,
        })

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
          
          toast({
            title: "Validation Error",
            description: "Please check the form for errors.",
            variant: "destructive",
            duration: 5000,
          })
        } else {
          toast({
            title: "Error",
            description: result.error || 'Something went wrong. Please try again.',
            variant: "destructive",
            duration: 5000,
          })
        }
        console.error('Submission error:', result)
      }
    } catch (error) {
      console.error('Form submission error:', error)
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
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
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
        
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            <div className="flex-1 space-y-6 max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold">
                Contact Us
              </h1>
              <p className="text-lg text-muted-foreground">
                Have questions about PathologyBites? We're here to help! Fill out the form below 
                and we'll get back to you as soon as possible.
              </p>
            </div>

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

      {/* Community Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Join Our Discord</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Connect with fellow pathology learners, share knowledge, and get quick answers to your questions 
            in our active Discord community.
          </p>
          <Button 
            size="lg" 
            className="bg-[#5865F2] hover:bg-[#4752C4] transform hover:scale-105 
                      transition-all duration-300 ease-in-out"
            onClick={() => window.open('YOUR_DISCORD_INVITE_LINK', '_blank')}
          >
            <Icons.discord className="h-5 w-5 mr-2" />
            Join Discord Server
          </Button>
        </div>
      </section>
    </div>
  )
}