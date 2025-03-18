// src/app/api/questions/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

const questionSchema = z.object({
  body: z.string().min(10, 'Question must be at least 10 characters'),
  explanation: z.string().min(10, 'Explanation must be at least 10 characters'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  yield: z.enum(['low', 'medium', 'high']),
  categories: z.array(z.string()).min(1, 'Select at least one category'),
  reference_text: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const json = await request.json()
    
    // Validate the request body
    const validatedData = questionSchema.parse(json)
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    
    // Insert the question
    const { data, error } = await supabase
      .from('questions')
      .insert({
        ...validatedData,
        created_by: user.id,
        status: 'draft'
      })
      .select()
      .single()

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
    const supabase = createRouteHandlerClient<Database>({ cookies })
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

    const yield_value = searchParams.get('yield')
    if (yield_value && yield_value !== 'ALL') {
      query = query.eq('yield', yield_value)
    }

    const search = searchParams.get('search')
    if (search) {
      query = query.ilike('body', `%${search}%`)
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