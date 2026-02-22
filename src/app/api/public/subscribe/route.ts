// src/app/api/public/subscribe/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Define error interface for Supabase errors
interface SupabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

/**
 * @swagger
 * /api/public/subscribe:
 *   post:
 *     summary: Subscribe to waitlist
 *     description: Add an email address to the waitlist. Handles duplicate emails gracefully and uses RLS policies with service role fallback.
 *     tags:
 *       - Public - Subscription
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to add to the waitlist
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Email already exists in waitlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: You are already subscribed to our waitlist!
 *       201:
 *         description: Successfully subscribed to waitlist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Successfully subscribed to waitlist!
 *       400:
 *         description: Bad request - invalid email format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Please provide a valid email address.
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 message:
 *                   type: string
 *                 code:
 *                   type: string
 *                 details:
 *                   type: string
 *                 hint:
 *                   type: string
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    
    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      )
    }
    
    // Initialize Supabase URLs and keys
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error. Please try again later.' },
        { status: 500 }
      )
    }
    
    // First try with anonymous key (should work with RLS policies)
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    try {
      // Insert email into waitlist table
      const { error } = await supabase
        .from('waitlist')
        .insert([{ email }])
      
      if (!error) {
        return NextResponse.json(
          { message: 'Successfully subscribed to waitlist!' },
          { status: 201 }
        )
      }
      
      // Check for duplicate email
      const supabaseError = error as SupabaseError;
      
      if (supabaseError.code === '23505' && supabaseError.message.includes('duplicate key')) {
        return NextResponse.json(
          { message: 'You are already subscribed to our waitlist!' },
          { status: 200 }
        )
      }
      
      // If we hit an RLS error and have a service key, try the fallback approach
      if (supabaseError.code === '42501' && supabaseServiceKey) {
        console.log('Falling back to service role key due to RLS error')
        return await tryServiceRoleInsert(supabaseUrl, supabaseServiceKey, email)
      }
      
      throw error
    } catch (error) {
      console.error('Supabase error with anon key:', error)
      
      // Try service role as fallback only if we have the key and got an RLS error
      const supabaseError = error as SupabaseError;
      
      if (supabaseError.code === '42501' && supabaseServiceKey) {
        return await tryServiceRoleInsert(supabaseUrl, supabaseServiceKey, email)
      }
      
      // Return the database error with proper status code
      return NextResponse.json(
        { 
          message: 'Failed to subscribe. Please try again later.',
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Unexpected error in subscribe API:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}

async function tryServiceRoleInsert(supabaseUrl: string, serviceKey: string, email: string) {
  try {
    // Create admin client that bypasses RLS
    const adminSupabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Try insertion with admin privileges
    const { error } = await adminSupabase
      .from('waitlist')
      .insert([{ email }])
    
    if (error) {
      console.error('Supabase error with service key:', error)
      
      const supabaseError = error as SupabaseError;
      
      // Check for duplicate email
      if (supabaseError.code === '23505' && supabaseError.message.includes('duplicate key')) {
        return NextResponse.json(
          { message: 'You are already subscribed to our waitlist!' },
          { status: 200 }
        )
      }
      
      // Return the database error
      return NextResponse.json(
        { 
          message: 'Failed to subscribe. Please try again later.',
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { message: 'Successfully subscribed to waitlist!' },
      { status: 201 }
    )
  } catch (serviceError) {
    console.error('Service role insertion error:', serviceError)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}