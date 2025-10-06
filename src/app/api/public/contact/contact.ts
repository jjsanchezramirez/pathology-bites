'use server'

import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createContactNotificationEmail } from '@/shared/utils/email-templates'

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



export async function submitContactForm(formData: ContactFormData) {
  try {
    // Validate form data
    const validatedData = formSchema.parse(formData)

    // Use service role key for contact form submissions
    // This bypasses RLS since we want anyone to be able to submit inquiries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Insert into database
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
      console.error('Database error:', dbError)
      return {
        success: false,
        error: `Database error: ${dbError.message}`,
        details: dbError
      }
    }

    // Send email
    console.log('Sending email notification...')
    const emailContent = createContactNotificationEmail({
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
      organization: validatedData.organization,
      requestType: validatedData.requestType,
      inquiry: validatedData.inquiry
    })
    let emailError = null

    try {
      const emailResult = await resend.emails.send({
        from: 'Pathology Bites <contact@pathologybites.com>',
        to: ['jjsanchezramirez@gmail.com'], // Replace with your email
        replyTo: validatedData.email,
        subject: `New ${validatedData.requestType === 'general' ? 'General' : 'Technical Support'} Inquiry from ${validatedData.firstName} ${validatedData.lastName}`,
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

    return {
      success: true,
      data: dbData,
      emailError: emailError ? 'Your message was saved but there was an issue sending the email notification. Our team will still receive your inquiry.' : null
    }
  } catch (error) {
    console.error('Contact form submission error:', error)

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
}