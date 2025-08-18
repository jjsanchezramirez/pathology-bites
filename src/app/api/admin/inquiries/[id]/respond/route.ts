import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { createAdminResponseEmail } from '@/shared/utils/email-templates'

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const responseSchema = z.object({
  response: z.string().min(1, 'Response is required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Inquiry response API called for ID:', params.id)

    const supabase = await createClient()
    const inquiryId = params.id

    // Auth is handled by middleware - user should be admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const validation = responseSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { response } = validation.data

    // Get the inquiry details
    console.log('Fetching inquiry with ID:', inquiryId)
    const { data: inquiry, error: inquiryError } = await supabase
      .from('inquiries')
      .select('*')
      .eq('id', inquiryId)
      .single()

    if (inquiryError || !inquiry) {
      console.error('Inquiry not found:', inquiryError)
      return NextResponse.json(
        { error: 'Inquiry not found' },
        { status: 404 }
      )
    }

    console.log('Found inquiry:', inquiry.id, 'from', inquiry.email)

    // Check if Resend is configured
    if (!resend) {
      console.warn('Resend API key not configured - running in test mode')
      // In test mode, just log the response instead of sending email
      console.log('TEST MODE - Would send email response:', {
        to: inquiry.email,
        response: response,
        inquiryId
      })

      return NextResponse.json({
        success: true,
        message: 'Response logged successfully (test mode - no email sent)'
      })
    }

    // Send email response
    try {
      console.log('Attempting to send email to:', inquiry.email)

      // Create professional email using the template
      const emailContent = createAdminResponseEmail({
        firstName: inquiry.first_name,
        lastName: inquiry.last_name,
        requestType: inquiry.request_type,
        originalInquiry: inquiry.inquiry,
        response: response
      })

      // Use verified pathologybites.com domain
      const emailResult = await resend!.emails.send({
        from: 'Pathology Bites <contact@pathologybites.com>',
        to: [inquiry.email],
        subject: `Re: Your ${inquiry.request_type === 'general' ? 'General' : 'Technical Support'} Inquiry`,
        html: emailContent.html,
        text: emailContent.text
      })

      if (emailResult.error) {
        console.error('Email sending failed:', emailResult.error)
        return NextResponse.json(
          { error: 'Failed to send email response', details: emailResult.error },
          { status: 500 }
        )
      }

      console.log('Email sent successfully to:', inquiry.email)

      // Auto-resolve the inquiry after successful response
      const { error: updateError } = await supabase
        .from('inquiries')
        .update({
          status: 'resolved',
          updated_at: new Date().toISOString()
        })
        .eq('id', inquiryId)

      if (updateError) {
        console.error('Failed to update inquiry status to resolved:', updateError)
        // Don't fail the request since email was sent successfully
      } else {
        console.log('Inquiry status updated to resolved:', inquiryId)
      }

      return NextResponse.json({
        success: true,
        message: 'Response sent successfully and inquiry marked as resolved'
      })

    } catch (emailError) {
      console.error('Error sending email:', emailError)
      return NextResponse.json(
        { error: 'Failed to send email response' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error responding to inquiry:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
