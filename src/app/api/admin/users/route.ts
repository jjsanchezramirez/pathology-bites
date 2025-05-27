import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin by querying their role in the database
    // We'll use a direct query with service role to bypass RLS
    const serviceSupabase = createServiceClient()

    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || 'all'
    const statusFilter = searchParams.get('status') || 'all'

    // Build query for counting
    let countQuery = serviceSupabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Build query for data
    let dataQuery = serviceSupabase
      .from('users')
      .select('*')

    // Apply search filter
    if (search) {
      const searchPattern = `%${search}%`
      countQuery = countQuery.or(`email.ilike.${searchPattern},first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`)
      dataQuery = dataQuery.or(`email.ilike.${searchPattern},first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`)
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      countQuery = countQuery.eq('role', roleFilter)
      dataQuery = dataQuery.eq('role', roleFilter)
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      countQuery = countQuery.eq('status', statusFilter)
      dataQuery = dataQuery.eq('status', statusFilter)
    }

    // Get total count
    const { count, error: countError } = await countQuery
    if (countError) {
      throw countError
    }

    // Calculate pagination
    const from = page * pageSize
    const to = from + pageSize - 1

    // Get paginated data
    const { data, error: dataError } = await dataQuery
      .order('created_at', { ascending: false })
      .range(from, to)

    if (dataError) {
      throw dataError
    }

    return NextResponse.json({
      users: data || [],
      totalUsers: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page
    })

  } catch (error) {
    console.error('Error in admin users API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const serviceSupabase = createServiceClient()

    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, updates } = body

    if (!userId || !updates) {
      return NextResponse.json({ error: 'Missing userId or updates' }, { status: 400 })
    }

    // Update user with service role to bypass RLS
    const { data, error } = await serviceSupabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ user: data })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
