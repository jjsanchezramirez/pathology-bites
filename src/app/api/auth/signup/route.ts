// src/app/api/auth/signup/route.ts
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, userType, recaptchaToken } = await request.json()
    
    // Verify reCAPTCHA Enterprise token
    // Note: For reCAPTCHA Enterprise, you need to use the Enterprise API for verification
    const projectId = process.env.RECAPTCHA_ENTERPRISE_PROJECT_ID || ''
    const apiKey = process.env.RECAPTCHA_ENTERPRISE_API_KEY || ''
    
    const verifyUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`
    
    const recaptchaResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: {
          token: recaptchaToken,
          siteKey: '6Lc0j_0qAAAAAPYTZIIVdNvJXX4hmZ6brnhk60ga',
          expectedAction: 'SIGNUP'
        }
      }),
    })
    
    const recaptchaData = await recaptchaResponse.json()
    
    // Check if verification failed or score too low
    if (!recaptchaData.tokenProperties?.valid || 
        recaptchaData.riskAnalysis?.score < 0.5) {
      return NextResponse.json({ 
        error: 'Verification failed. Please try again.' 
      }, { status: 400 })
    }
    
    // Create a Supabase admin client to bypass captcha
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Sign up the user with admin privileges (bypassing Supabase captcha)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        user_type: userType,
        full_name: `${firstName} ${lastName}`,
      }
    })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    // Create entry in users table
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: data.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          user_type: userType,
          full_name: `${firstName} ${lastName}`,
        },
      ])
    
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}