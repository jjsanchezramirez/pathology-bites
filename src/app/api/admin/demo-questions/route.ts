// src/app/api/admin/demo-questions/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
;

// Admin API for managing demo questions
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all demo questions with question details
    const { data: demoQuestions, error } = await supabase
      .from('demo_questions')
      .select(`
        id,
        question_id,
        is_active,
        display_order,
        questions (
          id,
          title,
          status
        )
      `)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching demo questions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch demo questions' },
        { status: 500 }
      );
    }

    return NextResponse.json(demoQuestions, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question_id, display_order } = body;

    if (!question_id) {
      return NextResponse.json(
        { error: 'question_id is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if question exists and is published
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, title, status')
      .eq('id', question_id)
      .eq('status', 'published')
      .single();

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found or not published' },
        { status: 404 }
      );
    }

    // Check if question is already in demo questions
    const { data: existing } = await supabase
      .from('demo_questions')
      .select('id')
      .eq('question_id', question_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Question is already in demo rotation' },
        { status: 409 }
      );
    }

    // Get next display order if not provided
    let nextOrder = display_order;
    if (!nextOrder) {
      const { data: maxOrder } = await supabase
        .from('demo_questions')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();
      
      nextOrder = (maxOrder?.display_order || 0) + 1;
    }

    // Add to demo questions
    const { data: newDemo, error: insertError } = await supabase
      .from('demo_questions')
      .insert({
        question_id,
        is_active: true,
        display_order: nextOrder
      })
      .select(`
        id,
        question_id,
        is_active,
        display_order,
        questions (
          id,
          title,
          status
        )
      `)
      .single();

    if (insertError) {
      console.error('Error adding demo question:', insertError);
      return NextResponse.json(
        { error: 'Failed to add demo question' },
        { status: 500 }
      );
    }

    return NextResponse.json(newDemo, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Demo question ID is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Remove from demo questions
    const { error } = await supabase
      .from('demo_questions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error removing demo question:', error);
      return NextResponse.json(
        { error: 'Failed to remove demo question' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, is_active, display_order } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Demo question ID is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update demo question
    const updateData: { is_active?: boolean; display_order?: number } = {};
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data: updated, error } = await supabase
      .from('demo_questions')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        question_id,
        is_active,
        display_order,
        questions (
          id,
          title,
          status
        )
      `)
      .single();

    if (error) {
      console.error('Error updating demo question:', error);
      return NextResponse.json(
        { error: 'Failed to update demo question' },
        { status: 500 }
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
