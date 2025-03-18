'use server'

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
}