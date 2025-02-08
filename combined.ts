// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()

  try {
    const supabase = createMiddlewareClient({ req: request, res })
    const { data: { session } } = await supabase.auth.getSession()
    const pathname = request.nextUrl.pathname

    console.log('Current pathname:', pathname)
    console.log('Session exists:', !!session)

    // Handle auth callback with PKCE flow
    if (pathname === '/auth/callback') {
      const code = request.nextUrl.searchParams.get('code')
      const next = request.nextUrl.searchParams.get('next') || '/dashboard'
      
      if (code) {
        return res
      }

      if (request.nextUrl.searchParams.get('type') === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', request.url))
      }

      return NextResponse.redirect(new URL(next, request.url))
    }

    // Allow access to reset-password page
    if (pathname === '/reset-password') {
      return res
    }

    // Regular auth protection
    if (!session) {
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } else {
      // Check admin routes BEFORE any other redirects
      if (pathname.startsWith('/admin')) {
        // Get user role from the users table
        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        console.log('Admin check - User data:', userData)
        console.log('Admin check - Error:', error)

        // If not admin, redirect to dashboard
        if (!userData || userData.role !== 'admin') {
          console.log('Not admin, redirecting to dashboard')
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        
        // If admin, allow access by continuing to res
        console.log('Admin access granted')
      }

      // Handle other authenticated routes
      if (pathname === '/login' || pathname === '/signup') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/auth/callback',
    '/reset-password',
  ]
}// src/app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const type = requestUrl.searchParams.get('type')
    const next = requestUrl.searchParams.get('next')

    if (code) {
      const cookieStore = await cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      // Exchange code for session
      await supabase.auth.exchangeCodeForSession(code)

      // If it's a recovery flow, redirect to reset password
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', request.url))
      }

      // Get the user's info for normal auth flow
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) throw userError

      if (user) {
        // Check if user is verified
        if (!user.email_confirmed_at) {
          return NextResponse.redirect(new URL('/verify-email', request.url))
        }

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from("users")
          .select('role')
          .eq('email', user.email)
          .single()

        if (existingProfile) {
          // Profile exists - update if it's a Google login
          if (user.app_metadata.provider === 'google') {
            await supabase
              .from("users")
              .update({
                first_name: user.user_metadata?.given_name || existingProfile.first_name,
                last_name: user.user_metadata?.family_name || existingProfile.last_name,
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id)
          }
          
          // Redirect based on role
          if (existingProfile.role === 'admin') {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url))
          }
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        // Create new profile for verified user
        const { error: profileError } = await supabase
          .from("users")
          .insert({
            id: user.id,
            email: user.email,
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            role: "user",
            user_type: user.user_metadata?.user_type || 'resident',
            status: "active"
          })

        if (profileError) {
          console.error('Error creating profile:', profileError)
          throw profileError
        }

        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    throw new Error('No code or user found')
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(
      new URL('/login?error=auth-callback-error', request.url)
    )
  }
}'use server'

import { z } from 'zod'
import { supabase } from '@/lib/supabase/client'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const formSchema = z.object({
  requestType: z.enum(['technical', 'general']),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  organization: z.string().optional(),
  email: z.string().email('Invalid email address'),
  inquiry: z.string().min(10, 'Inquiry must be at least 10 characters')
})

export type ContactFormData = z.infer<typeof formSchema>

function generateEmailContent(data: ContactFormData) {
  // Generate a readable request type (e.g., "Technical Support" instead of "technical")
  const readableRequestType = data.requestType === 'technical' ? 'Technical Support' : 'General Inquiry'
  
  // Get current date in a nice format
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return {
    subject: `New ${readableRequestType} from ${data.firstName} ${data.lastName}`,
    text: `
New Contact Form Submission

Request Type: ${readableRequestType}
Name: ${data.firstName} ${data.lastName}
Organization: ${data.organization || 'Not provided'}
Email: ${data.email}
Date: ${date}

Inquiry:
${data.inquiry}
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: hsl(var(--background)); font-family: system-ui, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 0.75rem; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
    <!-- Header with background pattern -->
    <div style="background-color: #ffffff; padding: 24px; text-align: left; position: relative;">
      <!-- Background patterns similar to website -->
      <div style="position: absolute; inset: 0; background-image: radial-gradient(circle at 30% 50%, rgba(56, 189, 248, 0.08), transparent 25%), radial-gradient(circle at 70% 50%, rgba(56, 189, 248, 0.08), transparent 25%); opacity: 0.5;"></div>
      <div style="position: relative;">
        <h1 style="color: hsl(222.2 47.4% 11.2%); margin: 0; font-size: 24px; font-weight: 600;">New Contact Form Submission</h1>
        <p style="color: hsl(215.4 16.3% 46.9%); margin: 8px 0 0 0; font-size: 16px;">${readableRequestType}</p>
      </div>
    </div>

    <!-- Content -->
    <div style="padding: 24px;">
      <div style="border: 1px solid hsl(214.3 31.8% 91.4%); border-radius: 0.75rem; padding: 16px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; color: hsl(222.2 47.4% 11.2%); font-size: 18px; font-weight: 600;">Contact Information</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: hsl(215.4 16.3% 46.9%); width: 120px;">Name:</td>
            <td style="padding: 8px 0; color: hsl(222.2 47.4% 11.2%);">${data.firstName} ${data.lastName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: hsl(215.4 16.3% 46.9%);">Organization:</td>
            <td style="padding: 8px 0; color: hsl(222.2 47.4% 11.2%);">${data.organization || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: hsl(215.4 16.3% 46.9%);">Email:</td>
            <td style="padding: 8px 0; color: hsl(222.2 47.4% 11.2%);">
              <a href="mailto:${data.email}" style="color: hsl(221.2 83.2% 53.3%); text-decoration: none;">${data.email}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: hsl(215.4 16.3% 46.9%);">Date:</td>
            <td style="padding: 8px 0; color: hsl(222.2 47.4% 11.2%);">${date}</td>
          </tr>
        </table>
      </div>

      <div style="border: 1px solid hsl(214.3 31.8% 91.4%); border-radius: 0.75rem; padding: 16px;">
        <h2 style="margin: 0 0 16px 0; color: hsl(222.2 47.4% 11.2%); font-size: 18px; font-weight: 600;">Inquiry</h2>
        <div style="color: hsl(222.2 47.4% 11.2%); line-height: 1.6;">
          ${data.inquiry.replace(/\n/g, '<br>')}
        </div>
      </div>

      <!-- Quick Actions -->
      <div style="margin-top: 24px; text-align: center;">
        <a href="mailto:${data.email}" 
           style="display: inline-block; background-color: hsl(221.2 83.2% 53.3%); color: #ffffff; padding: 12px 24px; 
                  text-decoration: none; border-radius: 0.5rem; font-weight: 500; margin: 0 8px;
                  transition: background-color 0.2s ease;">
          Reply to ${data.firstName}
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 24px; text-align: center; border-top: 1px solid hsl(214.3 31.8% 91.4%);">
      <p style="margin: 0; color: hsl(215.4 16.3% 46.9%); font-size: 14px;">
        This is an automated message from PathologyBites
      </p>
    </div>
  </div>
</body>
</html>
    `
  }
}

export async function submitContactForm(formData: ContactFormData) {
  console.log('Starting form submission...')
  
  try {
    // Validate form data
    console.log('Validating data:', formData)
    const validatedData = formSchema.parse(formData)
    console.log('Data validated successfully')

    // Insert into database
    console.log('Attempting database insertion...')
    const { data: dbData, error: dbError } = await supabase
      .from('inquiries')
      .insert([{
        request_type: validatedData.requestType,
        first_name: validatedData.firstName,
        last_name: validatedData.lastName,
        organization: validatedData.organization || null,
        email: validatedData.email,
        inquiry: validatedData.inquiry
      }])
      .select()
      .single()

    if (dbError) {
      console.error('Supabase error:', dbError)
      return {
        success: false,
        error: `Database error: ${dbError.message}`,
        details: dbError
      }
    }

    // Send email
    console.log('Sending email notification...')
    const emailContent = generateEmailContent(validatedData)
    let emailError = null
    
    try {
      const emailResult = await resend.emails.send({
        from: 'Pathology Bites <contact@pathologybites.com>',
        to: ['jjsanchezramirez@gmail.com'], // Replace with your email
        reply_to: validatedData.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      })

      if (emailResult.error) {
        console.error('Email sending failed:', emailResult.error)
        emailError = emailResult.error
      }
    } catch (error) {
      console.error('Error sending email:', error)
      emailError = error instanceof Error ? error.message : 'Failed to send email notification'
    }

    console.log('Submission successful:', dbData)
    return { 
      success: true, 
      data: dbData,
      emailError: emailError ? 'Your message was saved but there was an issue sending the email notification. Our team will still receive your inquiry.' : null
    }
  } catch (error) {
    console.error('Error in submitContactForm:', error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit inquiry'
    }
  }
}// src/app/layout.tsx
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Toaster } from "@/components/ui/toaster"
import { cn } from '@/lib/utils'
import '@/styles/globals.css'

export const metadata = {
  title: 'Pathology Bites',
  description: 'Master Pathology with bite-sized learning',
  icons: {
    icon: [
      { url: '/icons/microscope.svg', type: 'image/svg+xml' },
    ]
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <ThemeProvider attribute="class" defaultTheme="system">
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}/**
 * @source src/app/error.tsx
 * 
 * This file defines an ErrorPage component that displays a custom error message
 * when an error occurs in the application. It randomly selects a headline, message,
 * error code, and button text from predefined arrays to provide a unique error
 * experience each time. The component also logs the error to the console and
 * announces the error message to screen readers for accessibility.
 */

"use client";

import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import FloatingCharacter from "@/components/landing/dr-albright";

const ERROR_CONTENT = {
  headlines: [
    "Specimen Processing Error",
    "Specimen Mismatch Error",
    "Specimen Handling Error",
    "Tissue Processing Error"
  ],
  messages: [
    "The resident swears they put it in the cassette… we have our doubts.",
    "Looks like someone forgot the embedding. Again.",
    "We could blame the microtome, but let's be honest…",
    "Paraffin blocks don't just disappear... or do they?"
  ],
  prefixes: ["LAB", "HE", "PATH"],
  buttonMessages: [
    "Return to Grossing Station",
    "Return to the Bench",
    "Go Back to the Bucket",
    "Back to the Lab",
    "Back to the Microscope"
  ]
} as const;

const getRandomElement = <T,>(arr: T[]): T => 
  arr[Math.floor(Math.random() * arr.length)];

export default function ErrorPage({ 
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Log error
    console.error('Page Error:', error);
    
    // Announce error to screen readers
    const message = `Error occurred: ${error.message}`;
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('error-message')?.focus();
      }, 100);
    }
  }, [error]);

  const headline = getRandomElement(ERROR_CONTENT.headlines);
  const message = getRandomElement(ERROR_CONTENT.messages);
  const errorCode = `${getRandomElement(ERROR_CONTENT.prefixes)}-500`;
  const buttonText = getRandomElement(ERROR_CONTENT.buttonMessages);

  return (
    <main 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      role="alert"
      aria-labelledby="error-headline"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex justify-center w-full">
          <FloatingCharacter
            imagePath="/images/dr-albright.png"
            imageAlt="Dr. Albright Character"
            size={320}
            wrapperClassName="w-full md:w-auto"
          />
        </div>

        <div 
          className="text-center mt-8 space-y-4"
          tabIndex={-1}
          id="error-message"
        >
          <h1 
            id="error-headline"
            className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
          >
            {headline}
          </h1>
          <p 
            className="text-lg text-muted-foreground"
            aria-live="polite"
          >
            {message}
          </p>
          <p 
            className="text-sm text-muted-foreground/80"
            aria-label={`Error code: ${error?.digest || errorCode}`}
          >
            Error Code: {error?.digest || errorCode}
          </p>
          
          <Button 
            onClick={() => window.location.href = '/'}
            className="mt-4 bg-primary hover:bg-primary/90 shadow-lg 
              hover:shadow-primary/25 transition-all duration-300"
            aria-label={buttonText}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    </main>
  );
}
/**
 * @source src/app/(public)/contact/page.tsx
 * Contact page component with form submission and validation.
 * 
 * @component ContactPage
 * @description Renders a contact form with fields for request type, name, organization,
 * email and inquiry. Includes form validation, submission handling, and success/error
 * notifications. Also displays hero section with floating character and Discord community section.
 * 
 * @example
 * ```tsx
 * <ContactPage />
 * ```
 * 
 * @remarks
 * - Uses client-side form validation
 * - Handles form submission through submitContactForm action
 * - Displays toast notifications for success/error states
 * - Includes loading state during submission
 * - Responsive layout with mobile optimization
 * 
 * @typedef {Object} FormData
 * @property {'technical' | 'general'} requestType - Type of contact request
 * @property {string} firstName - User's first name
 * @property {string} lastName - User's last name
 * @property {string} organization - Optional organization name
 * @property {string} email - User's email address
 * @property {string} inquiry - User's message (min 10 characters)
 * 
 * @typedef {Partial<Record<keyof FormData, string>>} FormErrors
 * 
 * @returns {JSX.Element} Rendered contact page with form and sections
 */

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
import { submitContactForm } from '@/app/_actions/contact'

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
          // Handle Zod validation errors
          const newErrors: FormErrors = {}
          result.details.forEach((error: any) => {
            const path = error.path[0]
            newErrors[path] = error.message
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | 
    { target: { name: string; value: 'technical' | 'general' } }
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
      {/* Hero Section - unchanged */}
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
                  onValueChange={(value) => handleChange({ target: { name: 'requestType', value } } as any)}
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

      {/* Community Section - unchanged */}
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
}// src/app/privacy/page.tsx
'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import FloatingCharacter from "@/components/landing/dr-albright"

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
        
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            {/* Content */}
            <div className="flex-1 space-y-6 max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold">
                Privacy Policy
              </h1>
              <p className="text-lg text-muted-foreground">
                PathologyBites is committed to protecting your personal information. This policy outlines our 
                practices for collecting, using, and safeguarding your data while providing exceptional 
                pathology education.
              </p>
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
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
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
}// src/app/faq/page.tsx
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
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
        
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
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
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
}// src/app/terms/page.tsx
'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import FloatingCharacter from "@/components/landing/dr-albright"

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
        
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            {/* Content */}
            <div className="flex-1 space-y-6 max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-bold">
                Terms of Use
              </h1>
              <p className="text-lg text-muted-foreground">
                Please read these terms carefully before using PathologyBites. By accessing or using our platform, 
                you agree to be bound by these terms and conditions.
              </p>
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

      {/* Agreement Banner */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/90 to-primary" />
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
            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">General Terms</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  PathologyBites is an online educational service provided subject to your compliance 
                  with these terms and conditions. We reserve the right to modify these terms at our 
                  sole discretion. Continued use of the platform after any modifications indicates 
                  your acceptance of the updated terms.
                </p>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Disclaimer of Warranties</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>Our platform and its contents are provided "as is" without any warranties of any kind, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Merchantability</li>
                  <li>Fitness for a particular purpose</li>
                  <li>Non-infringement</li>
                  <li>Accuracy or completeness of content</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Intellectual Property</h2>
              <div className="space-y-4 text-muted-foreground">
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
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">User Responsibilities</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>You agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide accurate registration information</li>
                  <li>Maintain the security of your account</li>
                  <li>Use the platform for its intended educational purpose</li>
                  <li>Comply with all applicable laws and regulations</li>
                </ul>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Limitation of Liability</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  PathologyBites will not be liable for any damages arising from the use or inability 
                  to use our platform, including but not limited to direct, indirect, incidental, 
                  punitive, and consequential damages.
                </p>
              </div>
            </Card>

            <Card className="p-8 shadow-lg">
              <h2 className="text-2xl font-bold mb-4">Governing Law</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  These terms shall be governed by and construed in accordance with the laws of the 
                  state of Delaware, United States of America, without regard to its conflict of 
                  law provisions.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Questions About Our Terms?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            If you have any questions about these terms of use, please don't hesitate to contact us. 
            We're here to help clarify any concerns.
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
}// src/app/about/page.tsx
'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { 
  MicroscopeIcon, 
  GraduationCapIcon, 
  BookOpenIcon,
  UsersIcon,
  GlobeIcon,
  LightbulbIcon
} from "lucide-react"
import FloatingCharacter from "@/components/landing/dr-albright"
import { FeatureCard } from "@/components/landing/feature-card"

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">

    {/* Hero Section */}
    <section className="relative py-16 md:py-24 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between gap-8">
          {/* Content */}
          <div className="flex-1 space-y-6 max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-bold">
              Free Pathology Education for Everyone
            </h1>
            <p className="text-lg text-muted-foreground">
              We believe quality pathology education should be accessible to all. 
              Our platform provides comprehensive practice questions, detailed explanations, 
              and learning resources - completely free, forever.
            </p>
            <div>
              <Link href="/signup">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90"
                >
                  Start Learning
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
{/* Mission Section */}
<section className="relative py-20 bg-primary">
  <div className="container px-4 max-w-3xl mx-auto text-center relative">
    <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Our Mission</h2>
    <p className="text-xl mb-8 leading-relaxed text-white">
      To democratize pathology education by providing high-quality, accessible learning 
      resources to medical students, residents, and pathologists worldwide. We believe 
      that breaking down barriers to education creates better pathologists and ultimately 
      improves patient care.
    </p>
  </div>
</section>

      {/* Features Grid */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container px-4 max-w-6xl mx-auto relative">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">What We Offer</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={BookOpenIcon}
              title="Comprehensive Content"
              description="Expert-curated questions covering all major pathology subspecialties"
            />
            <FeatureCard
              icon={GlobeIcon}
              title="Open Access"
              description="Free access to all content and features, no subscription required"
            />
            <FeatureCard
              icon={GraduationCapIcon}
              title="Board Preparation"
              description="Questions aligned with current board examination formats"
            />
            <FeatureCard
              icon={UsersIcon}
              title="Community Learning"
              description="Learn alongside peers and benefit from shared knowledge"
            />
            <FeatureCard
              icon={LightbulbIcon}
              title="Detailed Explanations"
              description="In-depth explanations for every question to enhance understanding"
            />
            <FeatureCard
              icon={MicroscopeIcon}
              title="Quality Images"
              description="High-resolution pathology images with annotations"
            />
          </div>
        </div>
      </section>

      {/* Join Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
        <div className="container px-4 max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Join Our Learning Community</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start your learning journey today. No fees, no subscriptions - just 
            high-quality pathology education available to everyone.
          </p>
          <Link href="/signup">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 transform hover:scale-105 
                        transition-all duration-300 ease-in-out"
            >
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}// src/app/(public)/layout.tsx
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  )
}// src/app/page.tsx
'use client'

import { FeatureCard } from "@/components/landing/feature-card"
import { ScrollToTopButton } from "@/components/landing/scroll-to-top"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { BookOpenIcon, BarChartIcon, TestTube2Icon } from "lucide-react"
import DemoQuestion from "@/components/landing/demo-question"

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.12),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)] animate-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
        
        {/* Content Container */}
        <div className="container px-4 sm:px-6 lg:px-8 relative flex justify-center">
          <div className="relative max-w-4xl space-y-8 text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in">
              Master Pathology with{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-gradient">
                Bite-Sized Learning
              </span>
            </h1>

            <div className="space-y-8 animate-fade-in opacity-0" style={{ animationDelay: '0.7s' }}>
              <p className="mx-auto max-w-[42rem] text-xl text-muted-foreground">
                Elevate your diagnostic expertise with AI-powered case studies and personalized learning paths.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <Link href="/signup">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 px-8">
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="px-8">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <h2 className="text-center text-4xl font-bold mb-16">
            Transform Your Learning Experience
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            <FeatureCard
              icon={BookOpenIcon}
              title="Comprehensive Curriculum"
              description="Access our complete library of pathology questions covering all major subspecialties and board exam topics"
            />
            <FeatureCard
              icon={BarChartIcon}
              title="Smart Analytics"
              description="Track your progress with detailed performance analytics and competency heatmaps"
            />
            <FeatureCard
              icon={TestTube2Icon}
              title="Virtual Lab Cases"
              description="Practice with interactive case simulations featuring real histopathology slides"
            />
          </div>
        </div>
      </section>

      {/* Demo Question Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Experience Interactive Learning
            </h2>
            <p className="text-xl text-muted-foreground">
              Try a sample question from our extensive question bank
            </p>
          </div>
          <DemoQuestion />
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-foreground/10 to-transparent" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Open Educational Resource
            </h2>
            <p className="text-lg text-primary-foreground/90">
              Start your learning journey today. No fees, no subscriptions - just high-quality pathology education for everyone.
            </p>
            <div className="pt-4">
              <Link href="/signup">
                <Button 
                  size="lg" 
                  className="bg-white text-primary hover:bg-white/90 px-8
                    transform hover:scale-105 active:scale-95 
                    hover:shadow-xl hover:shadow-white/10
                    transition-all duration-300 ease-in-out 
                    relative overflow-hidden"
                >
                  Start Learning Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll To Top Button */}
      <ScrollToTopButton />
    </>
  )
}// src/app/(auth)/check-email/page.tsx
"use client"

import { Card } from "@/components/ui/card"
import { Microscope } from "lucide-react"
import Link from "next/link"

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <Card className="w-full p-6 space-y-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-gray-500">
                We've sent you a password reset link. Click the link in the email to reset your password.
              </p>
              <p className="text-sm text-gray-500">
                If you don't see the email, check your spam folder. The link will expire in 24 hours.
              </p>
              <Link 
                href="/login" 
                className="mt-4 text-primary hover:underline text-sm"
              >
                Return to login page
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}// src/app/signup/page.tsx
"use client"

import { SignupForm } from '@/components/auth/signup-form'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import React from 'react'

const SignUpPage: React.FC = () => {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleGoogleSignUp = async () => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        if (error.message?.includes('already exists')) {
          toast({
            description: "This email address is already registered. Please sign in instead.",
            duration: 5000
          })
          return
        }
        throw error
      }
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to connect to Google. Please try again.",
      })
      console.error('Google signup error:', error)
    }
  }

  const handleSignup = async (values: {
    email: string
    password: string
    firstName: string
    lastName: string
    userType: string
  }) => {
    try {
      // First check if the email exists in the users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', values.email)
        .single()

      if (existingUser) {
        toast({
          description: "This email address is already registered. Please sign in instead.",
          duration: 5000
        })
        return
      }

      // Proceed with signup if email doesn't exist
      const { error: signUpError, data } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            user_type: values.userType,
          },
          emailRedirectTo: `${window.location.origin}/confirm`
        },
      })
  
      if (signUpError) {
        if (signUpError.message?.includes('already registered')) {
          toast({
            description: "This email address is already registered. Please sign in instead.",
          })
          return
        }
        throw signUpError
      }
  
          // Store signup data in user metadata for later profile creation
      if (data.user) {
        await supabase.auth.updateUser({
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            user_type: values.userType,
          }
        })
      }
  
      router.push("/verify-email")
    } catch (error: any) {
      toast({
        variant: "destructive",
        description: "Something went wrong. Please try again."
      })
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <SignupForm 
            onSubmit={handleSignup}
            onGoogleSignUp={handleGoogleSignUp}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}

export default SignUpPage"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Microscope } from "lucide-react"
import Link from "next/link"

export default function ConfirmationPage() {
  const router = useRouter()

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.push("/login")
    }, 5000)

    return () => clearTimeout(timeout)
  }, [router])

  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <Card className="w-full p-6 space-y-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">Account Confirmed!</h1>
              <p className="text-gray-500">
                Your email has been verified. You will be redirected to login in a few seconds.
              </p>
              <Link href="/login" className="text-primary hover:underline">
                Click here if you are not redirected
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}// src/app/(auth)/verify-email/page.tsx
"use client"

import { Card } from "@/components/ui/card"
import { Microscope } from "lucide-react"
import Link from "next/link"

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <Card className="w-full p-6 space-y-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="text-gray-500">
                We've sent you a verification link. Please check your email to verify your account.
              </p>
              <p className="text-sm text-gray-500">
                If you don't see the email, check your spam folder. The link will expire in 24 hours.
              </p>
              <Link 
                href="/" 
                className="mt-4 text-primary hover:underline text-sm"
              >
                Return to home page
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}// src/app/(auth)/forgot-password/page.tsx
"use client"

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { Microscope } from "lucide-react"
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleResetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    
    if (error) {
      toast({
        variant: "destructive",
        description: "Error sending reset password email",
      })
      throw error
    }

    // Redirect to check email page
    router.push('/check-email')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <ForgotPasswordForm onSubmit={handleResetPassword} />
        </div>
      </div>
    </div>
  )
}// src/app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      {children}
    </div>
  )
}// src/app/(auth)/reset-password/page.tsx
"use client"

import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AuthError } from '@supabase/supabase-js'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('No active session')
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('Session check error:', error)
        toast({
          variant: "destructive",
          description: "Please use the reset link from your email to access this page.",
        })
        router.push('/login')
      }
    }

    checkSession()
  }, [router, toast, supabase.auth])

  const handlePasswordReset = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })
      
      if (error) {
        throw error
      }

      // Sign out after password update
      await supabase.auth.signOut()

      toast({
        description: "Password updated successfully! Please log in with your new password.",
      })
      
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (error) {
      console.error('Reset password error:', error)
      
      // Type guard to check if error is AuthError
      const isAuthError = (error: unknown): error is AuthError => {
        return (error as AuthError)?.message !== undefined
      }
      
      if (isAuthError(error)) {
        // Check specifically for same password error
        if (error.message.includes('should be different from the old password')) {
          toast({
            variant: "destructive",
            description: "New password must be different from your current password.",
          })
        } else {
          toast({
            variant: "destructive",
            description: "Error resetting password. Please try again.",
          })
        }
      } else {
        toast({
          variant: "destructive",
          description: "An unexpected error occurred. Please try again.",
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
        
        <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
          <div className="w-full max-w-sm space-y-8">
            <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
              <Microscope className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Pathology Bites
              </span>
            </Link>

            <div className="text-center text-muted-foreground">
              Verifying your session...
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col flex-1">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        {/* Match the login page's max-w-sm */}
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>
          <ResetPasswordForm onSubmit={handlePasswordReset}/>
        </div>
      </div>
    </div>
)
}// src/app/(auth)/login/page.tsx
"use client"

import { LoginForm } from '@/components/auth/login-form'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { Microscope } from "lucide-react"
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleEmailSignIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      toast({
        variant: "destructive",
        description: "Invalid email or password",
      })
      throw error
    }

    router.refresh()
    router.push('/dashboard')
  }

// src/app/(auth)/login/page.tsx
const handleGoogleSignIn = async () => {

  console.log("Redirect URL:", `${window.location.origin}/auth/callback`)

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,  // Update this path
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    toast({
      variant: "destructive",
      description: "Could not connect to Google",
    })
    throw error
  }
}

  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <LoginForm 
            onSubmit={handleEmailSignIn}
            onGoogleSignIn={handleGoogleSignIn}
          />
        </div>
      </div>
    </div>
  )
}// src/app/dashboard/page.tsx
"use client"

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">Total Questions</h3>
          <p className="text-3xl font-semibold">1,246</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">Questions Completed</h3>
          <p className="text-3xl font-semibold">128</p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">Average Score</h3>
          <p className="text-3xl font-semibold">76%</p>
        </div>
      </div>
    </div>
  )
}// src/app/(dashboard)/layout.tsx
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  )
}/**
 * @source src/app/not-found.tsx
 * 
 * This component renders a custom 404 Not Found page with randomized content.
 * It displays a headline, a message, an error code, and a button to navigate back to the home page.
 * The content is randomized from predefined arrays of headlines, messages, error codes, and button texts.
 * The component also includes a floating character image for visual appeal.
 * 
 * The null check in the useEffect hook is there to prevent flickering during the initial render.
 * It ensures that the random content is only generated once and not during the server-side rendering.
 */

"use client";

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import FloatingCharacter from "@/components/landing/dr-albright";

const ERROR_CONTENT = {
  headlines: [
    "Specimen Not Found",
    "Slides Not Found",
    "Stains Not Found"
  ],
  messages: [
    "The resident swears the slides were there… we have our doubts.",
    "Slides are missing… they're probably just on the microscope. Again.",
    "Slides seem to have disappeared… Accio slides!",
    "Slides can't just vanish… or can they?"
  ],
  prefixes: ["LAB", "HE", "PATH"],
  buttonMessages: [
    "Return to Grossing Station",
    "Return to the Bench",
    "Go Back to the Bucket",
    "Back to the Lab",
    "Back to the Microscope"
  ]
} as const;

type RandomContent = {
  headline: string;
  message: string;
  errorCode: string;
  buttonText: string;
};

const getRandomElement = <T,>(arr: T[]): T => 
  arr[Math.floor(Math.random() * arr.length)];

const generateRandomContent = (): RandomContent => ({
  headline: getRandomElement(ERROR_CONTENT.headlines),
  message: getRandomElement(ERROR_CONTENT.messages),
  errorCode: `${getRandomElement(ERROR_CONTENT.prefixes)}-404`,
  buttonText: getRandomElement(ERROR_CONTENT.buttonMessages)
});

export default function NotFoundPage() {
  // Keep the null check to prevent hydration mismatch
  const [randomContent, setRandomContent] = useState<RandomContent | null>(null);

  useEffect(() => {
    if (!randomContent) {
      setRandomContent(generateRandomContent());
    }
  }, [randomContent]);

  // Show nothing during server render and hydration
  if (!randomContent) {
    return null;
  }

  return (
    <main 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      role="alert"
      aria-labelledby="not-found-headline"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex justify-center w-full">
          <FloatingCharacter
            imagePath="/images/dr-albright.png"
            imageAlt="Dr. Albright Character"
            size={320}
            wrapperClassName="w-full md:w-auto"
          />
        </div>

        <div 
          className="text-center mt-8 space-y-4"
          tabIndex={-1}
          id="not-found-message"
        >
          <h1 
            id="not-found-headline"
            className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
          >
            {randomContent.headline}
          </h1>
          <p 
            className="text-lg text-muted-foreground"
            aria-live="polite"
          >
            {randomContent.message}
          </p>
          <p 
            className="text-sm text-muted-foreground/80"
            aria-label={`Error code: ${randomContent.errorCode}`}
          >
            Error Code: {randomContent.errorCode}
          </p>
          
          <Button 
            onClick={() => window.location.href = '/'}
            className="mt-4 bg-primary hover:bg-primary/90 shadow-lg 
              hover:shadow-primary/25 transition-all duration-300"
            aria-label={randomContent.buttonText}
          >
            {randomContent.buttonText}
          </Button>
        </div>
      </div>
    </main>
  );
}// src/app/(admin)/admin/dashboard/page.tsx
import { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileQuestion, Users, Image as ImageIcon, TrendingUp } from "lucide-react"

export const metadata: Metadata = {
  title: "Admin Dashboard - Pathology Bites",
  description: "Administrative dashboard overview",
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your admin dashboard overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <FileQuestion className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,350</div>
            <p className="text-xs text-muted-foreground">
              +180 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,284</div>
            <p className="text-xs text-muted-foreground">
              +10% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Library</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4,832</div>
            <p className="text-xs text-muted-foreground">
              +240 new images
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">76%</div>
            <p className="text-xs text-muted-foreground">
              +2.4% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Activity items would go here - simplified for example */}
              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium">New question submitted</p>
                  <p className="text-sm text-muted-foreground">
                    Dr. Smith added a new question on liver pathology
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium">Review pending questions</p>
                  <p className="text-sm text-muted-foreground">
                    12 questions awaiting review
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}// src/app/(admin)/admin/page.tsx
import { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileQuestion, Users, Image as ImageIcon, TrendingUp, AlertCircle, CheckCircle2, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Admin Dashboard - Overview",
  description: "Administrative dashboard overview",
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your admin dashboard overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <FileQuestion className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,350</div>
            <p className="text-xs text-muted-foreground">
              +180 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,284</div>
            <p className="text-xs text-muted-foreground">
              +10% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Library</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4,832</div>
            <p className="text-xs text-muted-foreground">
              +240 new images
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">76%</div>
            <p className="text-xs text-muted-foreground">
              +2.4% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-4 md:grid-cols-7">
        {/* Activity Feed */}
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="feedback">Feedback</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-4">
                <div className="flex items-start gap-4 rounded-lg border p-4">
                  <AlertCircle className="h-5 w-5 mt-0.5 text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Question Needs Review</p>
                    <p className="text-sm text-muted-foreground">
                      A new question about renal pathology requires moderation
                    </p>
                    <div className="flex items-center pt-2">
                      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">2 hours ago</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-lg border p-4">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-emerald-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">User Verification Complete</p>
                    <p className="text-sm text-muted-foreground">
                      Dr. Sarah Wilson's account has been verified
                    </p>
                    <div className="flex items-center pt-2">
                      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">4 hours ago</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-lg border p-4">
                  <AlertCircle className="h-5 w-5 mt-0.5 text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Content Reported</p>
                    <p className="text-sm text-muted-foreground">
                      User reported an issue with question #1234
                    </p>
                    <div className="flex items-center pt-2">
                      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">6 hours ago</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/admin/questions/review" className="block">
              <Button variant="outline" className="w-full justify-between">
                Review Pending Questions
                <div className="flex items-center">
                  <span className="mr-2 text-sm text-muted-foreground">12</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Button>
            </Link>
            <Link href="/admin/users/verify" className="block">
              <Button variant="outline" className="w-full justify-between">
                Verify New Users
                <div className="flex items-center">
                  <span className="mr-2 text-sm text-muted-foreground">5</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Button>
            </Link>
            <Link href="/admin/feedback" className="block">
              <Button variant="outline" className="w-full justify-between">
                Review User Feedback
                <div className="flex items-center">
                  <span className="mr-2 text-sm text-muted-foreground">8</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Button>
            </Link>
            <Link href="/admin/images/upload" className="block">
              <Button variant="outline" className="w-full justify-between">
                Upload New Images
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Latest user registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Dr. John Smith</p>
                      <p className="text-xs text-muted-foreground">Resident - Pathology</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View Profile
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Platform health overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Server Status</p>
                  <div className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 mr-2" />
                    <p className="text-sm text-muted-foreground">Operational</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-emerald-500">99.9%</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Response Time</p>
                  <p className="text-sm text-muted-foreground">Average</p>
                </div>
                <p className="text-sm font-medium">124ms</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Active Sessions</p>
                  <p className="text-sm text-muted-foreground">Current</p>
                </div>
                <p className="text-sm font-medium">243</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}// src/app/(admin)/admin/questions/page.tsx
import { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { QuestionsClient } from '@/components/questions/questions-client'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Questions - Admin Dashboard',
  description: 'Manage and organize your question bank',
}

// Example data - would normally come from database
const SAMPLE_QUESTIONS = [
  {
    id: '1',
    body: 'What is the most common cause of chronic kidney disease in adults?',
    difficulty: 'MEDIUM',
    rank: 'HIGH_YIELD',
    categories: [
      { id: 1, name: 'Nephrology', level: 1, parent_id: null, path: 'Nephrology' },
      { id: 2, name: 'CKD', level: 2, parent_id: 1, path: 'Nephrology/CKD' }
    ],
    explanation: 'Diabetes mellitus is the leading cause of CKD in adults...',
    reference_text: 'Harrison\'s Principles of Internal Medicine, 20e',
    images: [
      {
        id: 'img1',
        url: '/api/placeholder/400/300',
        description: 'Diabetic nephropathy histology',
        alt_text: 'Microscopic view of diabetic nephropathy'
      }
    ],
    created_at: '2024-01-01',
    updated_at: '2024-02-07'
  },
  {
    id: '2',
    body: 'Which of the following is characteristic of membranous nephropathy?',
    difficulty: 'HARD',
    rank: 'MEDIUM_YIELD',
    categories: [
      { id: 1, name: 'Nephrology', level: 1, parent_id: null, path: 'Nephrology' },
      { id: 3, name: 'Glomerular', level: 2, parent_id: 1, path: 'Nephrology/Glomerular' }
    ],
    explanation: 'Membranous nephropathy is characterized by...',
    reference_text: 'Robbins and Cotran Pathologic Basis of Disease, 10e',
    images: [],
    created_at: '2024-01-15',
    updated_at: '2024-02-01'
  }
]

export default async function QuestionsPage() {
  // Here you would normally fetch data from your database
  const questions = SAMPLE_QUESTIONS

  return (
    <div className="space-y-6 p-6 pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Questions</h1>
          <p className="text-muted-foreground">
            Manage and organize your question bank
          </p>
        </div>
        <Button className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      <QuestionsClient initialQuestions={questions} />
    </div>
  )
}// src/app/(admin)/layout.tsx
import { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { redirect } from "next/navigation"
import { AdminLayoutClient } from "@/components/admin/layout-client"

export const metadata: Metadata = {
  title: "Admin Dashboard - Pathology Bites",
  description: "Admin dashboard for managing Pathology Bites platform",
}

async function AdminLayoutServer() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.user?.id) {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single()

    if (user?.role !== "admin") {
      redirect("/dashboard")
    }
  } else {
    redirect("/login")
  }

  return null
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await AdminLayoutServer()
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
"use client"

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import {
  Controller,
  ControllerProps,
  FieldPath,
  FieldValues,
  FormProvider,
  useFormContext,
} from "react-hook-form"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField()

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message) : children

  if (!body) {
    return null
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
// src/components/landing/skeletons/demo-question-skeleton.tsx
'use client'

import React from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";

const QuestionSkeleton = () => {
  return (
    <Card className="w-full max-w-4xl mx-auto animate-pulse">
      <CardHeader>
        <div className="h-8 w-48 bg-muted rounded-lg" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question text skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded-lg w-3/4" />
          <div className="h-4 bg-muted rounded-lg w-full" />
          <div className="h-4 bg-muted rounded-lg w-2/3" />
        </div>

        {/* Image placeholder skeleton */}
        <div className="h-64 bg-muted rounded-lg w-full" />

        {/* Options skeleton */}
        <div className="grid gap-3">
          {[...Array(5)].map((_, index) => (
            <div 
              key={index}
              className="p-4 rounded-lg border-2 border-muted flex items-center gap-3"
            >
              <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0" />
              <div className="h-4 bg-muted rounded w-2/3 flex-grow" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuestionSkeleton;/**
 * @source src/components/landing/scroll-to-top.tsx
 * 
 * A React component that renders a "Scroll to Top" button which becomes visible 
 * when the user scrolls past a specified threshold. The button smoothly scrolls 
 * the page back to the top when clicked.
 */

'use client'

import { useState, useEffect } from "react"
import { ArrowUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScrollToTopProps {
  threshold?: number // Scroll threshold in pixels
  className?: string // Additional classes for the button
}

export function ScrollToTopButton({ 
  threshold = 500, 
  className 
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > threshold)
    }

    // Initial check
    toggleVisibility()
    
    // Add event listener with passive option for better performance
    window.addEventListener('scroll', toggleVisibility, { passive: true })
    
    // Cleanup
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [threshold])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={cn(
        "fixed bottom-8 right-8 p-3 rounded-full bg-primary hover:bg-primary/90",
        "shadow-lg hover:shadow-xl transition-all duration-300 text-white z-50",
        "opacity-0 invisible",
        isVisible && "opacity-100 visible",
        "transition-[opacity,visibility] duration-300 ease-in-out",
        className
      )}
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  )
}/**
 * @source src/components/landing/feature-card.tsx
 * 
 * A React component that displays a feature with an icon, title, and description.
 * The component supports additional styling through the `className` prop.
 */

import { cn } from "@/lib/utils"

interface FeatureCardProps {
  icon: React.ElementType
  title: string
  description: string
  className?: string
}

export function FeatureCard({ 
  icon: Icon, 
  title, 
  description,
  className 
}: FeatureCardProps) {
  return (
    <div className={cn(
      "group flex flex-col items-center text-center p-6",
      "bg-white/50 backdrop-blur-sm rounded-lg shadow-sm",
      "hover:shadow-md transition-all duration-300 hover:scale-105",
      className
    )}>
      <div className="flex items-center justify-center mb-4 transform group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2 transform group-hover:scale-105 transition-transform duration-300">
        {title}
      </h3>
      <p className="text-muted-foreground transform group-hover:scale-105 transition-transform duration-300">
        {description}
      </p>
    </div>
  )
}// src/components/landing/demo-question.tsx
'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, ExternalLink } from "lucide-react"
import QuestionSkeleton from "./skeletons/demo-question-skeleton"
import Image from 'next/image';

interface Option {
  id: string;
  text: string;
  correct: boolean;
}

interface Question {
  title: string;
  body: string;
  image: string;
  options: Option[];
  teachingPoint: string;
  incorrectExplanations: Record<string, string>;
  references: string[];
}

function DemoQuestion() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuestion({
        title: "Head & Neck Pathology",
        body: "A 32-year-old woman presents with a slowly growing, non-tender mass in the right parotid gland that has been present for approximately 8 months. Physical examination reveals a 2.5 cm mobile, well-circumscribed mass. CT imaging shows a well-defined lesion without infiltrative growth or lymphadenopathy. The patient undergoes a superficial parotidectomy. An image is shown below.\n\nWhich of the following is the MOST likely fusion product found in this neoplasm?",
        image: "https://www.pathologyoutlines.com/imgau/salivaryglandsMECasiry17.jpg",
        options: [
          { id: 'a', text: "EWSR1-ATF1", correct: false },
          { id: 'b', text: "LIFR-PLAG1", correct: false },
          { id: 'c', text: "HMGA2-NFIB", correct: false },
          { id: 'd', text: "CRTC1-MAML2", correct: true },
          { id: 'e', text: "ETV6-NR4A3", correct: false }
        ],
        teachingPoint: "CRTC1-MAML2 is the characteristic fusion found in approximately 55-75% of mucoepidermoid carcinomas (MECs). The histologic features in this case - including mucin-containing cells, intermediate cells, and well-formed cystic spaces - are classic for MEC. This fusion is associated with low to intermediate-grade tumors and better prognosis.",
        incorrectExplanations: {
          'a': "EWSR1-ATF1: This fusion is characteristic of hyalinizing clear cell carcinoma of salivary glands, which typically shows sheets of monomorphic cells with clear cytoplasm, distinct cell borders, and hyalinized stroma.",
          'b': "LIFR-PLAG1: This fusion is found in pleomorphic adenomas, which typically show a biphasic pattern with epithelial/myoepithelial cells in a chondromyxoid stroma.",
          'c': "HMGA2-NFIB: This fusion is also commonly found in pleomorphic adenomas.",
          'e': "ETV6-NR4A3: This fusion is characteristic of acinic cell carcinomas, which typically show the typical zymogen granules, basophilic cytoplasm, and acinar architecture."
        },
        references: [
          "https://www.pathologyoutlines.com/topic/salivaryglandsMEC.html",
          "Toper MH, Sarioglu S. Molecular pathology of salivary gland neoplasms: diagnostic, prognostic, and predictive perspective. Adv Anat Pathol. 2021;28(2):81–93."
        ]
      });
      setIsLoading(false);
      setTimeout(() => setShowContent(true), 100);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleOptionClick = (optionId: string) => {
    if (!isAnswered) {
      setSelectedOption(optionId);
      setIsAnswered(true);
      setTimeout(() => setShowExplanation(true), 300);
    }
  };

  const resetQuestion = () => {
    setShowContent(false);
    setShowExplanation(false);
    setIsLoading(true);
    setSelectedOption(null);
    setIsAnswered(false);
    setTimeout(() => {
      setIsLoading(false);
      setTimeout(() => setShowContent(true), 100);
    }, 2000);
  };

  if (isLoading || !question) return <QuestionSkeleton />;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="py-2">
        <CardTitle className={`text-lg transform transition-all duration-500 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          {question.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-sm text-foreground/90 transform transition-all duration-500 delay-100 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          {question.body}
        </div>

        <div className={`relative rounded-lg overflow-hidden border transform transition-all duration-500 delay-200 ${
          showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}>
          <Image
            src={question.image}
            alt="Pathology specimen"
            width={500}
            height={300}
            priority={true}
            className="w-full h-40 object-cover object-center"
          />
        </div>

        <div className="grid gap-2">
          {question.options.map((option, index) => {
            const isSelected = selectedOption === option.id;
            const showCorrect = isAnswered && option.correct;
            const showIncorrect = isAnswered && isSelected && !option.correct;

            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.id)}
                className={`
                  p-2 rounded-md text-left border text-sm transition-all duration-500
                  transform ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
                  ${!isAnswered ? 'hover:border-primary/50 hover:bg-primary/5' : ''}
                  ${isSelected ? 'border-primary' : 'border-border'}
                  ${showCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : ''}
                  ${showIncorrect ? 'bg-red-50 border-red-500 dark:bg-red-950/30' : ''}
                `}
                style={{ transitionDelay: `${300 + index * 100}ms` }}
                disabled={isAnswered}
              >
                <div className="flex items-center gap-2">
                  <span className={`
                    flex items-center justify-center w-5 h-5 rounded-full border text-xs
                    ${isSelected ? 'border-primary' : 'border-muted-foreground/30'}
                    ${showCorrect ? 'border-green-500' : ''}
                    ${showIncorrect ? 'border-red-500' : ''}
                  `}>
                    {option.id.toUpperCase()}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {showCorrect && <Check className="w-4 h-4 text-green-500" />}
                  {showIncorrect && <X className="w-4 h-4 text-red-500" />}
                </div>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={`transform transition-all duration-500 ${
            showExplanation ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}>
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-4">
              {/* Teaching Point */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Teaching Point</h4>
                <div className="text-muted-foreground">
                  {question.teachingPoint}
                </div>
              </div>

              {/* Molecular Genetics Table */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Molecular Genetics of Salivary Gland Tumors</h4>
                <div className="space-y-2">
                  <div className="max-w-full overflow-hidden">
                    <Image
                      src="https://www.captodayonline.com/wordpress/wp-content/uploads/2021/08/CytoTable_1.gif"
                      alt="Table showing characteristic genetic changes in salivary gland neoplasms"
                      width={500}
                      height={300}
                      priority={true}
                      className="max-w-full h-auto"
                      style={{ maxWidth: '100%' }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground italic">
                    Source: Toper MH, Sarioglu S. Molecular pathology of salivary gland neoplasms: diagnostic, prognostic, and predictive perspective. Adv Anat Pathol. 2021;28(2):81–93. Reprinted with permission.
                  </div>
                </div>
              </div>

              {/* Incorrect Explanations */}
              <div>
                <h4 className="font-medium text-xs uppercase mb-1">Incorrect Answer Explanations</h4>
                <div className="space-y-2 text-muted-foreground">
                  {Object.entries(question.incorrectExplanations)
                    .filter(([id]) => selectedOption && !question.options.find(opt => opt.id === id)?.correct)
                    .map(([id, explanation]) => (
                      <div key={id} className="flex gap-2">
                        <span className="font-medium">{id.toUpperCase()}.</span>
                        <span>{explanation}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* References */}
              <div className="text-xs text-muted-foreground">
                <h4 className="font-medium uppercase mb-1">References</h4>
                <ul className="space-y-1">
                  {question.references.map((ref, index) => (
                    <li key={index} className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      <a href={ref} target="_blank" rel="noopener noreferrer" 
                         className="hover:underline truncate">
                        {ref}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  onClick={resetQuestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Try Another
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DemoQuestion;// src/components/landing/dr-albright.tsx
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';

interface Particle {
  id: string;
  offset: number;
}

interface FloatingCharacterProps {
  imagePath: string;
  imageAlt: string;
  size?: number;
  wrapperClassName?: string;
}

const DEFAULT_SIZE = 288;
const SMOKE_POSITION = { x: 33, y: 40 };

const Smoke = ({ 
  offset, 
  containerSize 
}: { 
  offset: number;
  containerSize: number;
}) => {
  const particleSize = Math.max(containerSize / 96, 8);

  const style = {
    '--smoke-offset': `${offset}%`,
    '--smoke-x': `${SMOKE_POSITION.x}%`,
    '--smoke-y': `${SMOKE_POSITION.y}%`,
    width: `${particleSize}px`,
    height: `${particleSize}px`,
  } as React.CSSProperties;

  return (
    <div
      className="smoke-particle absolute rounded-full bg-primary/20 z-10"
      style={style}
    />
  );
};

const FloatingCharacter = ({ 
  imagePath, 
  imageAlt,
  size = DEFAULT_SIZE,
  wrapperClassName = "",
}: FloatingCharacterProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  const addParticle = useCallback(() => {
    const newParticle = {
      id: crypto.randomUUID(),
      offset: Math.random() * 20 - 10
    };

    setParticles(prev => [...prev, newParticle]);

    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== newParticle.id));
    }, 2000);
  }, []);

  useEffect(() => {
    const particleInterval = setInterval(addParticle, 300);

    const resetInterval = setInterval(() => {
      clearInterval(particleInterval);
      setTimeout(() => {
        const newParticleInterval = setInterval(addParticle, 300);
        setTimeout(() => clearInterval(newParticleInterval), 1200);
      }, 0);
    }, 2500);

    return () => {
      clearInterval(particleInterval);
      clearInterval(resetInterval);
    };
  }, [addParticle]);

  return (
    <>
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(-8px); }
          50% { transform: translateY(8px); }
        }

        @keyframes smoke {
          0% {
            bottom: var(--smoke-y);
            left: var(--smoke-x);
            transform: scale(0.8);
            opacity: 1;
          }
          60% {
            bottom: calc(var(--smoke-y) + 35%);
            left: calc(var(--smoke-x) + var(--smoke-offset));
            transform: scale(1.5);
            opacity: 0.6;
          }
          100% {
            bottom: calc(var(--smoke-y) + 50%);
            left: calc(var(--smoke-x) + var(--smoke-offset) * 2);
            transform: scale(2);
            opacity: 0;
          }
        }

        .smoke-particle {
          animation: smoke 2s ease-out forwards;
        }

        .floating {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      <div 
        className={`relative ${wrapperClassName}`} 
        style={{ 
          width: `${size}px`,
          height: `${size}px`,
          maxWidth: '100%'
        }}
      >
        {particles.map((particle) => (
          <Smoke 
            key={particle.id} 
            offset={particle.offset} 
            containerSize={size}
          />
        ))}
        
        <div className="floating relative w-full h-full z-0">
          <Image
            src={imagePath}
            alt={imageAlt}
            fill
            sizes={`${size}px`}
            className="object-contain"
            priority
          />
        </div>
      </div>
    </>
  );
};

export default FloatingCharacter;// src/components/auth/reset-password-form.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/theme/icons"
import { cn } from "@/lib/utils"

interface ResetPasswordFormProps {
  className?: string
  onSubmit: (password: string) => Promise<void>
}

export function ResetPasswordForm({
  className,
  onSubmit,
  ...props
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long"
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter"
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter"
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number"
    }
    return ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate password
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      await onSubmit(password)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-6">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error && error.includes("Password must")}
                required
                disabled={isLoading}
              />
              {error && error.includes("Password must") && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={!!error && error === "Passwords do not match"}
                required
                disabled={isLoading}
              />
              {error && error === "Passwords do not match" && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              Password must:
              <ul className="list-disc list-inside">
                <li>Be at least 8 characters long</li>
                <li>Include at least one uppercase letter</li>
                <li>Include at least one lowercase letter</li>
                <li>Include at least one number</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full mt-6"
              disabled={isLoading}
            >
              {isLoading && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isLoading ? "Updating..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}// src/components/auth/forgot-password-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Icons } from "@/components/theme/icons"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// Form schema definition
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type FormData = z.infer<typeof formSchema>

interface ForgotPasswordFormProps {
  className?: string
  onSubmit: (email: string) => Promise<void>
}

export function ForgotPasswordForm({ className, onSubmit }: ForgotPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  const onFormSubmit = async (values: FormData) => {
    setIsLoading(true)
    try {
      await onSubmit(values.email)
      toast({
        title: "Success",
        description: "Check your email for the password reset link.",
      })
    } catch (error) {
      console.error("Reset password error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "Failed to send reset link. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                {...register("email")}
                aria-invalid={!!errors.email}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send Reset Link
            </Button>
            <div className="text-center">
              <Link 
                href="/login" 
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                tabIndex={0}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        Having trouble? Contact{" "}
        <Link href="/contact" tabIndex={0}>support</Link>{" "}
        for assistance.
      </div>
    </div>
  )
}// src/components/auth/login-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/theme/icons"
import { useToast } from "@/hooks/use-toast"

// Form schema definition
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

// Define type for form data
type FormData = z.infer<typeof formSchema>

interface LoginFormProps {
  className?: string
  onSubmit?: (email: string, password: string) => Promise<void>
  onGoogleSignIn?: () => Promise<void>
}

export function LoginForm({
  className,
  onSubmit,
  onGoogleSignIn,
  ...props
}: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { toast } = useToast()
  
  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  // Form submission handler
  async function onFormSubmit(values: FormData) {
    try {
      setIsLoading(true)
      if (onSubmit) {
        await onSubmit(values.email, values.password)
        toast({
          title: "Success",
          description: "Successfully logged in",
        })
      }
    } catch (error) {
      console.error("Login error:", error)
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error 
          ? error.message 
          : "Failed to sign in. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    try {
      setGoogleLoading(true)
      if (onGoogleSignIn) {
        await onGoogleSignIn()
        toast({
          title: "Success",
          description: "Successfully logged in with Google",
        })
      }
    } catch (error) {
      console.error("Google login error:", error)
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Failed to sign in with Google. Please try again.",
      })
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Login with Google or your email account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || googleLoading}
                >
                  {googleLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.google className="mr-2 h-4 w-4" />
                  )}
                  Login with Google
                </Button>
              </div>
              <div className="relative text-center text-sm">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative z-10">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    aria-invalid={!!errors.email}
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                      tabIndex={0}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    {...register("password")}
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    disabled={isLoading}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive" role="alert">
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading || googleLoading}
                >
                  {isLoading && (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Login
                </Button>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link 
                  href="/signup" 
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                  tabIndex={0}
                >
                  Sign up
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
      By clicking continue, you agree to our{" "}
      <Link href="/terms" tabIndex={0}>Terms of Service</Link>{" "}
      and{" "}
      <Link href="/privacy" tabIndex={0}>Privacy Policy</Link>.
    </div>
    </div>
  )
}'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Icons } from "@/components/theme/icons"

const formSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  userType: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type FormData = z.infer<typeof formSchema>

interface SignupFormProps {
  className?: string
  onSubmit: (values: Omit<FormData, "confirmPassword">) => Promise<void>
  onGoogleSignUp?: () => Promise<void>
}

export function SignupForm({ className, onSubmit, onGoogleSignUp }: SignupFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userType: 'resident'
    }
  })

  const onFormSubmit = async (values: FormData) => {
    try {
      setIsLoading(true)
      const { confirmPassword, ...submitData } = values
      await onSubmit(submitData)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    if (!onGoogleSignUp) return
    try {
      setGoogleLoading(true)
      await onGoogleSignUp()
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className={className}>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>
            Sign up to start learning pathology
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-0">
            {onGoogleSignUp && (
              <div className="space-y-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignUp}
                  disabled={isLoading || googleLoading}
                >
                  {googleLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.google className="mr-2 h-4 w-4" />
                  )}
                  Sign up with Google
                </Button>

              <div className="relative text-sm">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative text-center">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
            </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  aria-invalid={!!errors.firstName}
                  disabled={isLoading}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive" role="alert">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  aria-invalid={!!errors.lastName}
                  disabled={isLoading}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive" role="alert">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                {...register("email")}
                aria-invalid={!!errors.email}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive" role="alert">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                aria-invalid={!!errors.password}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive" role="alert">{errors.password.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword" 
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword")}
                aria-invalid={!!errors.confirmPassword}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive" role="alert">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="userType">User Type</Label>
              <Select
                value={watch("userType")}
                onValueChange={val => setValue("userType", val)}
                disabled={isLoading}
              >
                <SelectTrigger id="userType">
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="fellow">Fellow</SelectItem>
                  <SelectItem value="attending">Attending</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading && (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Account
              </Button>
            </div>
            <div>
              <div className="text-center text-sm text-muted-foreground mt-4">
                Already have an account?{" "}
                <Link 
                  href="/login" 
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Login
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary space-y-1">
  <div>By signing up, you agree to our</div>
  <div>
    <Link href="/terms" tabIndex={0}>Terms of Service</Link>{" "}
    and{" "}
    <Link href="/privacy" tabIndex={0}>Privacy Policy</Link>.
  </div>
</div>
    </div>
  )
}/**
 * @source src/components/layout/navbar.tsx
 * 
 * This component renders the navigation bar for the application.
 * It includes links to the home page, login page, and signup page.
 * The navigation bar is fixed at the top of the page and has a responsive design.
 */

'use client'

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MicroscopeIcon } from "lucide-react"

export function Navbar() {
  return (
    <div className="fixed top-0 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <MicroscopeIcon className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Pathology Bites
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="hover:bg-primary/10 transition-colors">
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/25 transition-all duration-300">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}/**
 * @source src/components/layout/footer.tsx
 *
 * Component that renders the footer section of the application.
 * It includes a copyright notice and a navigation menu with links to various pages.
 * The footer is styled with Tailwind CSS classes for layout and design.
 */

import Link from "next/link"
import { MicroscopeIcon } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-background/95">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between h-16 text-sm">
        <div className="flex items-center gap-2">
          <MicroscopeIcon className="h-4 w-4 text-primary" />
          <p className="text-muted-foreground">© 2024 Pathology Bites. All rights reserved.</p>
        </div>
        <nav className="flex gap-6 text-muted-foreground">
          <Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link>
          <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          <Link href="/about" className="hover:text-primary transition-colors">About</Link>
          <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
        </nav>
      </div>
    </footer>
  )
}// src/components/admin/layout-client.tsx
'use client'

import { useState } from 'react'
import { AdminSidebar } from './sidebar'
import { AdminHeader } from './header'

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar isCollapsed={isSidebarCollapsed} />

      <div className="flex-1 flex flex-col">
        <AdminHeader onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />

        <main className="flex-1 overflow-auto relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.13),transparent_25%)]" />
          <div className="relative p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}// src/components/admin/notifications-handler.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Bell, Loader2, AlertCircle, Info, ChevronDown, Flag, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

interface NotificationState {
  id: string
  user_id: string
  source_type: 'inquiry' | 'report'
  source_id: string
  read: boolean
  created_at: string
}

interface BaseNotification {
  id: string
  created_at: string
  read: boolean
}

interface InquiryNotification extends BaseNotification {
  type: 'technical_inquiry' | 'general_inquiry'
  title: string
  description: string
  metadata: {
    inquiryId: string
    requestType: string
    email: string
    status: string
  }
}

interface ReportNotification extends BaseNotification {
  type: 'question_report'
  title: string
  description: string
  metadata: {
    reportId: string
    questionId: string
    reportType: string
    reportedBy: string
    status: string
  }
}

type Notification = InquiryNotification | ReportNotification

const NOTIFICATIONS_PER_PAGE = 10

export function NotificationsHandler() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<'all' | 'inquiries' | 'reports'>('all')
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    loadNotifications()
    setupSubscriptions()
  }, [filter])

  const loadNotifications = async (loadMore = false) => {
    try {
      setLoading(true)
      const currentPage = loadMore ? page + 1 : 0

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      // Get notification states
      const { data: states, error: statesError } = await supabase
        .from('notification_states')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (statesError) throw statesError

      // Create a map of read states
      const readStates = new Map(
        states.map(state => [`${state.source_type}-${state.source_id}`, state.read])
      )

      // Load notifications based on filter
      let notifications: Notification[] = []

      if (filter !== 'reports') {
        const { data: inquiries, error: inquiriesError } = await supabase
          .from('inquiries')
          .select('*')
          .order('created_at', { ascending: false })
          .range(currentPage * NOTIFICATIONS_PER_PAGE, (currentPage + 1) * NOTIFICATIONS_PER_PAGE)

        if (inquiriesError) throw inquiriesError

        const inquiryNotifications = inquiries.map(inquiry => ({
          id: inquiry.id,
          type: `${inquiry.request_type}_inquiry` as 'technical_inquiry' | 'general_inquiry',
          title: `New ${inquiry.request_type.charAt(0).toUpperCase() + inquiry.request_type.slice(1)} Inquiry`,
          description: `${inquiry.first_name} ${inquiry.last_name} from ${inquiry.organization || 'Unknown Organization'}`,
          created_at: inquiry.created_at,
          read: readStates.get(`inquiry-${inquiry.id}`) ?? false,
          metadata: {
            inquiryId: inquiry.id,
            requestType: inquiry.request_type,
            email: inquiry.email,
            status: inquiry.status
          }
        }))

        notifications = [...notifications, ...inquiryNotifications]
      }

      if (filter !== 'inquiries') {
        const { data: reports, error: reportsError } = await supabase
          .from('question_reports')
          .select(`
            *,
            questions (
              title
            )
          `)
          .order('created_at', { ascending: false })
          .range(currentPage * NOTIFICATIONS_PER_PAGE, (currentPage + 1) * NOTIFICATIONS_PER_PAGE)

        if (reportsError) throw reportsError

        const reportNotifications = reports.map(report => ({
          id: report.id,
          type: 'question_report' as const,
          title: 'Question Report',
          description: `Report: ${report.report_type} for "${report.questions.title}"`,
          created_at: report.created_at,
          read: readStates.get(`report-${report.id}`) ?? false,
          metadata: {
            reportId: report.id,
            questionId: report.question_id,
            reportType: report.report_type,
            reportedBy: report.reported_by,
            status: report.status
          }
        }))

        notifications = [...notifications, ...reportNotifications]
      }

      // Sort combined notifications by date
      notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setNotifications(prev => 
        loadMore ? [...prev, ...notifications] : notifications
      )
      setHasMore(notifications.length === NOTIFICATIONS_PER_PAGE)
      setPage(currentPage)
    } catch (error) {
      console.error('Error loading notifications:', error)
      toast({
        variant: "destructive",
        title: "Error loading notifications",
        description: "Please try again later"
      })
    } finally {
      setLoading(false)
    }
  }

  const setupSubscriptions = () => {
    // Subscribe to new inquiries
    const inquiriesSubscription = supabase
      .channel('inquiries-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inquiries'
        },
        payload => handleNewInquiry(payload.new)
      )
      .subscribe()

    // Subscribe to new reports
    const reportsSubscription = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'question_reports'
        },
        payload => handleNewReport(payload.new)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(inquiriesSubscription)
      supabase.removeChannel(reportsSubscription)
    }
  }

  const handleNewInquiry = async (inquiry: any) => {
    if (filter === 'reports') return

    const notification: InquiryNotification = {
      id: inquiry.id,
      type: `${inquiry.request_type}_inquiry` as 'technical_inquiry' | 'general_inquiry',
      title: `New ${inquiry.request_type.charAt(0).toUpperCase() + inquiry.request_type.slice(1)} Inquiry`,
      description: `${inquiry.first_name} ${inquiry.last_name} from ${inquiry.organization || 'Unknown Organization'}`,
      created_at: inquiry.created_at,
      read: false,
      metadata: {
        inquiryId: inquiry.id,
        requestType: inquiry.request_type,
        email: inquiry.email,
        status: inquiry.status
      }
    }
    
    setNotifications(prev => [notification, ...prev])
    
    toast({
      title: notification.title,
      description: notification.description,
    })
  }

  const handleNewReport = async (report: any) => {
    if (filter === 'inquiries') return

    // Fetch question details
    const { data: question } = await supabase
      .from('questions')
      .select('title')
      .eq('id', report.question_id)
      .single()

    const notification: ReportNotification = {
      id: report.id,
      type: 'question_report',
      title: 'New Question Report',
      description: `Report: ${report.report_type} for "${question?.title}"`,
      created_at: report.created_at,
      read: false,
      metadata: {
        reportId: report.id,
        questionId: report.question_id,
        reportType: report.report_type,
        reportedBy: report.reported_by,
        status: report.status
      }
    }
    
    setNotifications(prev => [notification, ...prev])
    
    toast({
      title: notification.title,
      description: notification.description,
    })
  }

  const markAsRead = async (notification: Notification) => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const sourceType = notification.type === 'question_report' ? 'report' : 'inquiry'

      const { error } = await supabase
        .from('notification_states')
        .upsert({
          user_id: user.user.id,
          source_type: sourceType,
          source_id: notification.id,
          read: true,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast({
        variant: "destructive",
        title: "Error updating notification",
        description: "Please try again later"
      })
    }
  }

  const getNotificationIcon = (notification: Notification) => {
    if (notification.type === 'question_report') {
      return notification.metadata.status === 'resolved' ? 
        <CheckCircle className="h-4 w-4 text-green-500" /> :
        <Flag className="h-4 w-4 text-red-500" />
    }
    
    if (notification.metadata.status === 'resolved') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    
    return notification.type === 'technical_inquiry' ?
      <AlertCircle className="h-4 w-4 text-yellow-500" /> :
      <Info className="h-4 w-4 text-blue-500" />
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'in_progress':
      case 'in_review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'dismissed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="relative rounded-full"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-[400px] max-h-[85vh]" // Increased width and max height
      >
        <div className="px-2 py-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  notifications
                    .filter(n => !n.read)
                    .forEach(n => markAsRead(n))
                }}
              >
                Mark all as read
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'inquiries' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setFilter('inquiries')}
            >
              Inquiries
            </Button>
            <Button
              variant={filter === 'reports' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setFilter('reports')}
            >
              Reports
            </Button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="py-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 hover:bg-muted/50 cursor-pointer ${
                    !notification.read ? 'bg-muted/30' : ''
                  }`}
                  onClick={() => markAsRead(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {notification.title}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {notification.description}
                      </div>
                      {notification.type !== 'question_report' && notification.metadata.email && (
                        <div className="text-sm text-muted-foreground truncate">
                          {notification.metadata.email}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          getStatusBadgeColor(notification.metadata.status)
                        }`}>
                          {(notification.metadata.status || 'pending').replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="p-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8"
                    onClick={() => loadNotifications(true)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-1">
                        Load more
                        <ChevronDown className="h-3 w-3" />
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {filter === 'all' 
                ? 'No notifications'
                : filter === 'inquiries'
                  ? 'No inquiries'
                  : 'No reports'}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}// src/components/admin/search-bar.tsx
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SearchBar() {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search questions, users..."
        className="pl-8 bg-background"
      />
    </div>
  );
}// src/components/admin/header.tsx
'use client'

import { Search, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProfileDropdown } from "@/components/dashboard/profile-dropdown"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { NotificationsHandler } from "@/components/admin/notifications-handler"

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function AdminHeader({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="h-16 border-b bg-background flex items-center px-4 gap-4">
      {/* Sidebar Toggle */}
      <Button 
        variant="ghost" 
        size="icon"
        onClick={onToggleSidebar}
        className="text-muted-foreground hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="w-64">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-8 h-9"
          />
        </div>
      </div>
      
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
        <NotificationsHandler />
        <ProfileDropdown />
      </div>
    </header>
  )
}// src/components/admin/sidebar.tsx
'use client'

import { 
  LayoutDashboard, 
  Users, 
  FileQuestion,
  BarChart,
  Image,
  Settings,
  Microscope
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navigation = [
  {
    name: "Overview",
    href: "/admin",
    icon: LayoutDashboard
  },
  {
    name: "Questions",
    href: "/admin/questions",
    icon: FileQuestion
  },
  {
    name: "Users",
    href: "/admin/users",
    icon: Users
  },
  {
    name: "Images",
    href: "/admin/images",
    icon: Image
  },
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: BarChart
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings
  }
]

interface SidebarProps {
  isCollapsed: boolean;
}

export function AdminSidebar({ isCollapsed }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 text-slate-100 dark:bg-slate-800/95 flex flex-col flex-shrink-0 transition-all duration-300`}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-6 border-b border-slate-700/50 dark:border-slate-600/50">
        <Microscope className="h-6 w-6 flex-shrink-0" />
        {!isCollapsed && (
          <h1 className="font-bold text-lg ml-3 whitespace-nowrap">Pathology Bites</h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <div className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex h-10 rounded-lg text-sm font-medium 
                  transition-colors duration-200 relative
                  ${isActive 
                    ? 'bg-slate-800 text-slate-100 dark:bg-slate-700 dark:text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white'
                  }`}
                title={isCollapsed ? item.name : undefined}
              >
                <div className={`
                  absolute left-3 top-1/2 -translate-y-1/2
                  flex items-center
                  ${isCollapsed ? 'w-5 justify-center' : ''}
                `}>
                  <item.icon className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                  <span className="truncate pl-10 py-2.5">{item.name}</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}// src/components/dashboard/profile-dropdown.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { User as LucideUser } from "lucide-react"
import { User } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface UserDisplayInfo {
  displayName: string
  email: string
  avatarUrl?: string
}

export function ProfileDropdown() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          throw error
        }
        
        setUser(user)
      } catch (error) {
        console.error('Error fetching user:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load user profile",
        })
      } finally {
        setIsLoading(false)
      }
    }
    
    getUser()
  }, [toast])

  const getUserDisplayInfo = (user: User | null): UserDisplayInfo => {
    if (!user) {
      return {
        displayName: 'Guest',
        email: 'guest@example.com'
      }
    }

    return {
      displayName: user.email ? user.email.split('@')[0] : 'User',
      email: user.email || 'No email provided',
      avatarUrl: user.user_metadata?.avatar_url
    }
  }

  const handleLogout = async () => {
    try {
      setIsLoading(true)
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }
      
      router.push('/login')
      toast({
        title: "Success",
        description: "Successfully logged out",
      })
    } catch (error) {
      console.error('Error signing out:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleNavigation = (path: string) => {
    try {
      router.push(path)
    } catch (error) {
      console.error('Navigation error:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to navigate. Please try again.",
      })
    }
  }

  const userInfo = getUserDisplayInfo(user)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-10 w-10 rounded-full border border-gray-200 hover:bg-gray-100 focus:ring-2 focus:ring-primary"
          disabled={isLoading}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage 
              src={userInfo.avatarUrl || "/avatars/placeholder.png"} 
              alt={`${userInfo.displayName}'s profile`} 
            />
            <AvatarFallback>
              <LucideUser className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userInfo.displayName}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {userInfo.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => handleNavigation('/dashboard/profile')}
          >
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={() => handleNavigation('/dashboard/settings')}
          >
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="text-red-600 cursor-pointer focus:text-red-600" 
          onClick={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? 'Logging out...' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}// src/components/dashboard/header.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Menu, Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProfileDropdown } from "@/components/dashboard/profile-dropdown"
import { useTheme } from "next-themes"

interface HeaderProps {
  isOpen: boolean
  onMenuClick: () => void
}

export function Header({ isOpen, onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className={cn(
      "fixed top-0 right-0 h-16 bg-background z-10 border-b",
      "transition-all duration-300 ease-in-out",
      isOpen ? "left-64" : "left-20"
    )}>
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onMenuClick}
            className="hover:bg-primary/10"
          >
            <Menu size={20} />
          </Button>
          <h1 className="text-xl font-semibold">Overview</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hover:bg-primary/10"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}// src/components/dashboard/sidebar.tsx
"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Plus, ClipboardList, BarChart2 } from "lucide-react"

interface SidebarProps {
  isOpen: boolean
}

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "New Quiz",
    href: "/dashboard/quiz/new",
    icon: Plus,
  },
  {
    title: "My Quizzes",
    href: "/dashboard/quiz/history",
    icon: ClipboardList,
  },
  {
    title: "Statistics",
    href: "/dashboard/statistics",
    icon: BarChart2,
  },
]

export function Sidebar({}: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-[#5BA4A4] text-white">
      {/* Logo */}
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">Pathology Bites</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md text-white/90 hover:bg-white/10",
                isActive && "bg-white/20"
              )}
            >
              <item.icon size={20} />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}// src/components/dashboard/dashboard-layout.tsx
"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { Sidebar } from "@/components/dashboard/sidebar"
import { cn } from "@/lib/utils"
import { ThemeProvider } from "@/components/theme/theme-provider"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isOpen, setIsOpen] = useState(true)
  
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="min-h-screen bg-background">
        <Sidebar isOpen={isOpen} />
        <Header 
          isOpen={isOpen} 
          onMenuClick={() => setIsOpen(!isOpen)}
        />
        <main className={cn(
          "transition-all duration-300 ease-in-out",
          "min-h-screen bg-background",
          isOpen ? "ml-64" : "ml-20",
          "pt-24 px-8" // Increased padding
        )}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  )
}// src/components/theme/theme-provider.tsx
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}/**
 * @source src/components/theme/icons.tsx
 * 
 * Collection of icon components used throughout the application.
 * Includes both Lucide icons and custom SVG implementations for various services.
 */

import { Apple, Loader2, LucideProps } from "lucide-react"

export const Icons = {
  spinner: Loader2,
  apple: Apple,
  google: (props: LucideProps) => (
    <svg
      aria-hidden="true"
      focusable="false"
      data-prefix="fab"
      data-icon="google"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 488 512"
      {...props}
    >
      <path
        fill="currentColor"
        d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
      ></path>
    </svg>
  ),
  discord: (props: LucideProps) => (
    <svg
      aria-hidden="true"
      focusable="false"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 127.14 96.36"
      {...props}
    >
      <path
        fill="currentColor"
        d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
      />
    </svg>
  ),
}// src/components/theme/theme-toggle.tsx
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}// src/components/questions/questions-client.tsx
'use client'

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { QuestionFilters } from '@/components/questions/question-filters'
import { QuestionTable } from '@/components/questions/question-table'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Question, Category } from '@/lib/types/questions'

interface QuestionsClientProps {
  initialQuestions: Question[]
}

export function QuestionsClient({ initialQuestions }: QuestionsClientProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    difficulty: 'ALL',
    yield: 'ALL'
  })

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleDelete = async (id: string) => {
    // Would normally make API call here
    console.log('Deleting question:', id)
  }

  // Convert categories array to Map for the table component
  const categoryPaths = new Map(
    initialQuestions.flatMap(q => 
      q.categories.map(c => [c.id, c])
    )
  )

  const hasFilters = filters.search !== '' || 
    filters.difficulty !== 'ALL' || 
    filters.yield !== 'ALL'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question Bank</CardTitle>
        <CardDescription>
          View, filter, and manage all questions in the database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <QuestionFilters 
            filters={filters}
            onFilterChange={handleFilterChange}
          />
          
          <QuestionTable
            questions={initialQuestions}
            categoryPaths={categoryPaths}
            isLoading={isLoading}
            onDelete={handleDelete}
            hasFilters={hasFilters}
          />
        </div>
      </CardContent>
    </Card>
  )
}// src/components/questions/question-row.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ImageIcon, PencilIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Category {
  id: number
  name: string
  level: number
  parent_id: number | null
  path: string
}

interface Image {
  id: string
  url: string
  description: string
  alt_text: string
}

interface Question {
  id: string
  body: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  rank: 'HIGH_YIELD' | 'MEDIUM_YIELD' | 'LOW_YIELD'
  categories: Category[]
  explanation: string
  reference_text: string | null
  images: Image[]
  created_at: string
  updated_at: string
}

interface QuestionRowProps {
  question: Question
  categoryPaths: Map<number, Category>
  onDelete: (questionId: string) => void
}

const difficultyConfig = {
  EASY: { 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', 
    short: 'E' 
  },
  MEDIUM: { 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', 
    short: 'M' 
  },
  HARD: { 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300', 
    short: 'H' 
  }
} as const

const yieldConfig = {
  HIGH_YIELD: { 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300', 
    short: 'HY' 
  },
  MEDIUM_YIELD: { 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', 
    short: 'MY' 
  },
  LOW_YIELD: { 
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300', 
    short: 'LY' 
  }
} as const

function getCategoryPathString(category: Category, categoryPaths: Map<number, Category>): string {
  const parts: string[] = [category.name]
  let currentId = category.parent_id
  
  while (currentId) {
    const parent = categoryPaths.get(currentId)
    if (parent) {
      parts.unshift(parent.name)
      currentId = parent.parent_id
    } else {
      break
    }
  }
  
  return parts.join(' → ')
}

export default function QuestionRow({ question, categoryPaths, onDelete }: QuestionRowProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showImages, setShowImages] = useState(false)

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    try {
      await onDelete(question.id)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Main Row */}
      <tr className={`group hover:bg-muted/50 dark:hover:bg-muted/20 ${
        isDeleting ? 'opacity-50 pointer-events-none' : ''
      }`}>
        {/* Question Column */}
        <td className="py-2 pl-4 pr-3 text-sm sm:pl-6">
          <div className="flex items-start gap-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 p-0.5 hover:bg-muted/50 dark:hover:bg-muted/20 rounded"
            >
              {isExpanded ? 
                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" /> : 
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
              }
            </button>
            <div className="flex-1">
              <div className="font-medium text-foreground dark:text-gray-100">
                {question.body.length > 60
                  ? `${question.body.substring(0, 60)}...`
                  : question.body
                }
              </div>
            </div>
          </div>
        </td>

        {/* Categories Column */}
        <td className="px-2 py-2 text-sm text-muted-foreground dark:text-gray-300">
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {question.categories.slice(0, 2).map((category) => (
              <TooltipProvider key={category.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {category.name}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{getCategoryPathString(category, categoryPaths)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {question.categories.length > 2 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      +{question.categories.length - 2}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      {question.categories.slice(2).map(category => (
                        <p key={category.id}>{getCategoryPathString(category, categoryPaths)}</p>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </td>

        {/* Images Column */}
        <td className="px-2 py-2 text-sm text-muted-foreground dark:text-gray-300">
          {question.images.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowImages(!showImages)}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <ImageIcon className="h-4 w-4" />
                <span>{question.images.length}</span>
              </button>
              
              {showImages && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowImages(false)} />
                  <div className="absolute z-50 mt-2 w-96 bg-background border border-input shadow-lg rounded-md overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 p-2">
                      {question.images.map((image) => (
                        <div key={image.id} className="relative aspect-square rounded-md overflow-hidden">
                          <Image
                            src={image.url}
                            alt={image.alt_text}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 33vw"
                          />
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                            <p className="text-white text-sm truncate">
                              {image.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </td>

        {/* Difficulty Column */}
        <td className="px-2 py-2 text-sm text-muted-foreground dark:text-gray-300">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium ${difficultyConfig[question.difficulty].color}`}>
                  {difficultyConfig[question.difficulty].short}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {question.difficulty}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>

        {/* Yield Column */}
        <td className="px-2 py-2 text-sm text-muted-foreground dark:text-gray-300">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium ${yieldConfig[question.rank].color}`}>
                  {yieldConfig[question.rank].short}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {question.rank.replace('_', ' ')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>

        {/* Updated Column */}
        <td className="px-2 py-2 text-xs text-muted-foreground dark:text-gray-300">
          {new Date(question.updated_at).toLocaleDateString()}
        </td>

        {/* Actions Column */}
        <td className="px-2 py-2 text-right text-sm text-muted-foreground dark:text-gray-300">
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-muted/50 dark:hover:bg-muted/20 dark:text-gray-300 dark:hover:text-gray-100"
              asChild
            >
              <Link href={`/admin/questions/${question.id}/edit`}>
                <PencilIcon className="h-3 w-3" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <TrashIcon className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Expanded Content Row */}
      {isExpanded && (
        <tr className="bg-muted/50 dark:bg-muted/10">
          <td colSpan={7} className="px-6 py-4">
            <div className="text-sm text-foreground dark:text-gray-100">
              <div className="font-medium mb-2">Full Question:</div>
              <p className="mb-4 text-muted-foreground dark:text-gray-300">{question.body}</p>
              <div className="font-medium mb-2">Explanation:</div>
              <p className="mb-2 text-muted-foreground dark:text-gray-300">{question.explanation}</p>
              {question.reference_text && (
                <>
                  <div className="font-medium mb-2">Reference:</div>
                  <p className="text-muted-foreground dark:text-gray-300">{question.reference_text}</p>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}// src/components/questions/question-table/index.tsx
'use client'

import { QuestionTableHeader } from './question-table-header'
import { QuestionTableBody } from './question-table-body'
import { QuestionTableEmpty } from './question-table-empty'
import { QuestionTableLoading } from './question-table-loading'

interface Category {
  id: number
  name: string
  level: number
  parent_id: number | null
  path: string
}

interface Image {
  id: string
  url: string
  description: string
  alt_text: string
}

interface Question {
  id: string
  body: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  rank: 'HIGH_YIELD' | 'MEDIUM_YIELD' | 'LOW_YIELD'
  categories: Category[]
  explanation: string
  reference_text: string | null
  images: Image[]
  created_at: string
  updated_at: string
}

interface QuestionTableProps {
  questions: Question[]
  categoryPaths: Map<number, Category>
  isLoading: boolean
  onDelete: (id: string) => void
  hasFilters: boolean
}

export function QuestionTable({
  questions,
  categoryPaths,
  isLoading,
  onDelete,
  hasFilters
}: QuestionTableProps) {
  if (isLoading) {
    return <QuestionTableLoading />
  }

  if (questions.length === 0) {
    return <QuestionTableEmpty hasFilters={hasFilters} />
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="min-w-full divide-y divide-border">
        <QuestionTableHeader />
        <QuestionTableBody
          questions={questions}
          categoryPaths={categoryPaths}
          onDelete={onDelete}
        />
      </table>
    </div>
  )
}// src/components/questions/question-table/question-table-header.tsx
export function QuestionTableHeader() {
    return (
      <thead className="bg-muted/50">
        <tr>
          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-medium text-muted-foreground">
            Question
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Categories
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Images
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Difficulty
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Yield
          </th>
          <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
            Updated
          </th>
          <th scope="col" className="relative py-3.5 pl-3 pr-4">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
    )
  }// src/components/questions/question-table/question-table-body.tsx
import QuestionRow from '../question-row'

interface QuestionTableBodyProps {
  questions: Question[]
  categoryPaths: Map<number, Category>
  onDelete: (id: string) => void
}

export function QuestionTableBody({ questions, categoryPaths, onDelete }: QuestionTableBodyProps) {
  return (
    <tbody className="divide-y divide-border bg-background">
      {questions.map((question) => (
        <QuestionRow 
          key={question.id} 
          question={question}
          categoryPaths={categoryPaths}
          onDelete={onDelete}
        />
      ))}
    </tbody>
  )
}// src/components/questions/question-table/question-table-loading.tsx
import { Loader2 } from 'lucide-react'

export function QuestionTableLoading() {
  return (
    <div className="flex justify-center items-center h-32">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}// src/components/questions/question-table/question-table-empty.tsx
import { AlertCircle } from 'lucide-react'

interface QuestionTableEmptyProps {
  hasFilters: boolean
}

export function QuestionTableEmpty({ hasFilters }: QuestionTableEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-center">
      <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
      <p className="text-muted-foreground">No questions found</p>
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? 'Try adjusting your search or filters'
          : 'Click "Add Question" to create your first question'}
      </p>
    </div>
  )
}// src/components/questions/question-table/index.tsx
'use client'

import { QuestionTableHeader } from './question-table-header'
import { QuestionTableBody } from './question-table-body'
import { QuestionTableEmpty } from './question-table-empty'
import { QuestionTableLoading } from './question-table-loading'

interface Category {
  id: number
  name: string
  level: number
  parent_id: number | null
  path: string
}

interface Image {
  id: string
  url: string
  description: string
  alt_text: string
}

interface Question {
  id: string
  body: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  rank: 'HIGH_YIELD' | 'MEDIUM_YIELD' | 'LOW_YIELD'
  categories: Category[]
  explanation: string
  reference_text: string | null
  images: Image[]
  created_at: string
  updated_at: string
}

interface QuestionTableProps {
  questions: Question[]
  categoryPaths: Map<number, Category>
  isLoading: boolean
  onDelete: (id: string) => void
  hasFilters: boolean
}

export function QuestionTable({
  questions,
  categoryPaths,
  isLoading,
  onDelete,
  hasFilters
}: QuestionTableProps) {
  if (isLoading) {
    return <QuestionTableLoading />
  }

  if (questions.length === 0) {
    return <QuestionTableEmpty hasFilters={hasFilters} />
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="min-w-full divide-y divide-border">
        <QuestionTableHeader />
        <QuestionTableBody
          questions={questions}
          categoryPaths={categoryPaths}
          onDelete={onDelete}
        />
      </table>
    </div>
  )
}

// src/components/questions/question-table/question-table-header.tsx
export function QuestionTableHeader() {
  return (
    <thead className="bg-muted/50">
      <tr>
        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-medium text-muted-foreground">
          Question
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Categories
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Images
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Difficulty
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Yield
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Updated
        </th>
        <th scope="col" className="relative py-3.5 pl-3 pr-4">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  )
}

// src/components/questions/question-table/question-table-empty.tsx
import { AlertCircle } from 'lucide-react'

interface QuestionTableEmptyProps {
  hasFilters: boolean
}

export function QuestionTableEmpty({ hasFilters }: QuestionTableEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-center">
      <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
      <p className="text-muted-foreground">No questions found</p>
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? 'Try adjusting your search or filters'
          : 'Click "Add Question" to create your first question'}
      </p>
    </div>
  )
}

// src/components/questions/question-table/question-table-loading.tsx
import { Loader2 } from 'lucide-react'

export function QuestionTableLoading() {
  return (
    <div className="flex justify-center items-center h-32">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

// src/components/questions/question-table/question-table-body.tsx
import QuestionRow from '../question-row'

interface QuestionTableBodyProps {
  questions: Question[]
  categoryPaths: Map<number, Category>
  onDelete: (id: string) => void
}

export function QuestionTableBody({ questions, categoryPaths, onDelete }: QuestionTableBodyProps) {
  return (
    <tbody className="divide-y divide-border bg-background">
      {questions.map((question) => (
        <QuestionRow 
          key={question.id} 
          question={question}
          categoryPaths={categoryPaths}
          onDelete={onDelete}
        />
      ))}
    </tbody>
  )
}// src/components/questions/question-filters.tsx
'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface QuestionFilter {
  search: string
  difficulty: string
  yield: string
}

interface QuestionFiltersProps {
  filters: QuestionFilter
  onFilterChange: (key: keyof QuestionFilter, value: string) => void
}

export function QuestionFilters({ filters, onFilterChange }: QuestionFiltersProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search questions..."
          className="pl-9"
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Select
          value={filters.difficulty}
          onValueChange={(value) => onFilterChange('difficulty', value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Difficulties</SelectItem>
            <SelectItem value="EASY">Easy</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HARD">Hard</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.yield}
          onValueChange={(value) => onFilterChange('yield', value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Yield" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Yields</SelectItem>
            <SelectItem value="HIGH_YIELD">High Yield</SelectItem>
            <SelectItem value="MEDIUM_YIELD">Medium Yield</SelectItem>
            <SelectItem value="LOW_YIELD">Low Yield</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}// src/hooks/use-toast.ts
"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

export const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// src/lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const createClient = () => {
  return createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })
}

export const supabase = createClient()