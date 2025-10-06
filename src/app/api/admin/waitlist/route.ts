import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    const { searchParams } = new URL(request.url)
    const exportFormat = searchParams.get('export')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Handle CSV export
    if (exportFormat === 'csv') {
      const { data: allData, error } = await supabase
        .from('waitlist')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching waitlist for export:', error)
        return NextResponse.json(
          { error: 'Failed to export waitlist data' },
          { status: 500 }
        )
      }

      // Generate CSV content
      const csvHeaders = 'Email,Joined Date,ID\n'
      const csvContent = (allData || [])
        .map(entry => `"${entry.email}","${new Date(entry.created_at).toLocaleDateString()}","${entry.id}"`)
        .join('\n')
      
      const csv = csvHeaders + csvContent

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="waitlist-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Get waitlist entries with pagination
    const { data: waitlistData, error: waitlistError, count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (waitlistError) {
      console.error('Error fetching waitlist:', waitlistError)
      return NextResponse.json(
        { error: 'Failed to fetch waitlist data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: waitlistData || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Unexpected error in waitlist API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}