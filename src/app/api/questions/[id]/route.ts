// src/app/api/questions/[id]/route.ts
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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    const { data, error } = await supabase
      .from('questions')
      .select(`
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
      .eq('id', params.id)
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching question:', error)
    return NextResponse.json(
      { error: 'Failed to fetch question' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const json = await request.json()
    
    // Validate the request body
    const validatedData = questionSchema.parse(json)
    
    const { data, error } = await supabase
      .from('questions')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating question:', error)
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting question:', error)
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    )
  }
}