import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Deleting inquiry with ID:', params.id)
    
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

    // First, get the inquiry to return its details
    const { data: inquiry, error: fetchError } = await supabase
      .from('inquiries')
      .select('*')
      .eq('id', inquiryId)
      .single()

    if (fetchError || !inquiry) {
      console.error('Inquiry not found:', fetchError)
      return NextResponse.json(
        { error: 'Inquiry not found' },
        { status: 404 }
      )
    }

    // Delete the inquiry
    const { error: deleteError } = await supabase
      .from('inquiries')
      .delete()
      .eq('id', inquiryId)

    if (deleteError) {
      console.error('Failed to delete inquiry:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete inquiry' },
        { status: 500 }
      )
    }

    console.log('Inquiry deleted successfully:', inquiryId)

    return NextResponse.json({
      success: true,
      message: 'Inquiry deleted successfully',
      deletedInquiry: inquiry
    })

  } catch (error: any) {
    console.error('Error deleting inquiry:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
