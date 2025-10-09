import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create Supabase client with service role for admin operations
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: Request) {
  try {
    // Use regular client for auth
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: userData, error: userError } = await authClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData || userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Use service role client for database operations to bypass RLS
    const supabase = createAdminClient()
    
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