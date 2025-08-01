// src/app/api/admin/invite-users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { z } from 'zod'

const inviteUsersSchema = z.object({
  emails: z.array(z.string().email('Invalid email address')).min(1, 'At least one email is required'),
  role: z.enum(['user', 'creator', 'reviewer', 'admin'], {
    invalid_type_error: 'Invalid role specified'
  }),
  message: z.string().optional(),
  expiresInHours: z.number().min(1).max(168).optional().default(72) // Default 3 days, max 1 week
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate request data
    const validation = inviteUsersSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
      return NextResponse.json({ error: errors.join('. ') }, { status: 400 })
    }

    const { emails, role, message, expiresInHours } = validation.data

    // Remove duplicates and check for existing users
    const uniqueEmails = [...new Set(emails)]
    const results = {
      invited: [] as string[],
      alreadyExists: [] as string[],
      failed: [] as { email: string, error: string }[]
    }

    // Check which emails already exist
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('email')
      .in('email', uniqueEmails)

    if (checkError) {
      console.error('Error checking existing users:', checkError)
      return NextResponse.json({ error: 'Failed to check existing users' }, { status: 500 })
    }

    const existingEmails = new Set(existingUsers?.map(u => u.email) || [])

    // Process each email
    for (const email of uniqueEmails) {
      try {
        if (existingEmails.has(email)) {
          results.alreadyExists.push(email)
          continue
        }

        // Generate invitation token
        const invitationToken = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

        // Create invitation record
        const { error: inviteError } = await supabase
          .from('user_invitations')
          .insert({
            email: email,
            role: role,
            invited_by: user.id,
            invitation_token: invitationToken,
            expires_at: expiresAt.toISOString(),
            message: message || null,
            status: 'pending'
          })

        if (inviteError) {
          console.error('Error creating invitation:', inviteError)
          results.failed.push({ email, error: 'Failed to create invitation' })
          continue
        }

        // Send invitation email using Supabase Auth
        const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${invitationToken}`
        
        // Use Supabase's admin invite function
        const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: inviteUrl,
          data: {
            role: role,
            invitation_token: invitationToken,
            invited_by: user.id,
            custom_message: message
          }
        })

        if (emailError) {
          console.error('Error sending invitation email:', emailError)
          // Mark invitation as failed
          await supabase
            .from('user_invitations')
            .update({ status: 'failed' })
            .eq('invitation_token', invitationToken)
          
          results.failed.push({ email, error: 'Failed to send invitation email' })
          continue
        }

        results.invited.push(email)

        // Create audit log
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'user_invited',
            table_name: 'user_invitations',
            record_id: invitationToken,
            new_values: {
              email: email,
              role: role,
              expires_at: expiresAt.toISOString()
            },
            metadata: {
              invited_by: user.id,
              timestamp: new Date().toISOString()
            }
          })

      } catch (error) {
        console.error(`Error processing invitation for ${email}:`, error)
        results.failed.push({ 
          email, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return NextResponse.json({
      success: true,
      results: results,
      summary: {
        total: uniqueEmails.length,
        invited: results.invited.length,
        alreadyExists: results.alreadyExists.length,
        failed: results.failed.length
      }
    })

  } catch (error) {
    console.error('Error in user invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/admin/invite-users - Get invitation history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get invitation history
    const { data: invitations, error: inviteError } = await supabase
      .from('user_invitations')
      .select(`
        *,
        invited_by_user:users!user_invitations_invited_by_fkey(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (inviteError) {
      console.error('Error fetching invitations:', inviteError)
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      invitations: invitations || []
    })

  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
