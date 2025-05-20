// src/app/api/questions/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

// Updated schema to match the database structure
const questionSchema = z.object({
  // Use field names that match the database
  title: z.string().min(1, 'Title is required'),
  stem: z.string().min(10, 'Question must be at least 10 characters'),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  question_references: z.string().optional(),
  // Note: created_by and status will be added in the route handler
})

export async function POST(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    const json = await request.json()
    
    // Validate the request body
    const validatedData = questionSchema.parse(json)
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('User is not authenticated');

    // Insert the question with the correct field mapping
    const { data, error } = await supabase
      .from('questions')
      .insert({
        ...validatedData,
        created_by: user.id,
        status: 'draft'
      })
      .select()
      .single();

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating question:', error)
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    const { searchParams } = new URL(request.url)
    
    let query = supabase.from('questions').select(`
      *,
      categories (
        id,
        name,
        level,
        parent_id,
        path
      ),
      images (
        id,
        url,
        description,
        alt_text
      )
    `)

    // Apply filters if provided
    const difficulty = searchParams.get('difficulty')
    if (difficulty && difficulty !== 'ALL') {
      query = query.eq('difficulty', difficulty)
    }

    // Note: 'yield' is missing from our database type, check if it exists in your database
    const yield_value = searchParams.get('yield')
    if (yield_value && yield_value !== 'ALL') {
      query = query.eq('yield', yield_value)
    }

    const search = searchParams.get('search')
    if (search) {
      query = query.ilike('stem', `%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching questions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}