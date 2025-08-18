import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { z } from 'zod'

const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'resolved', 'closed'])
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Updating inquiry status for ID:', params.id)
    
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
    const validation = statusUpdateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { status } = validation.data

    // Update inquiry status
    const { data: updatedInquiry, error: updateError } = await supabase
      .from('inquiries')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', inquiryId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update inquiry status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update inquiry status' },
        { status: 500 }
      )
    }

    if (!updatedInquiry) {
      return NextResponse.json(
        { error: 'Inquiry not found' },
        { status: 404 }
      )
    }

    console.log('Inquiry status updated successfully:', updatedInquiry.id, 'to', status)

    return NextResponse.json({
      success: true,
      message: `Inquiry status updated to ${status}`,
      inquiry: updatedInquiry
    })

  } catch (error: any) {
    console.error('Error updating inquiry status:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
