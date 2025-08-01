// Debug endpoint to check demo questions status
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
        { error: 'Failed to fetch demo questions', details: error },
        { status: 500 }
      );
    }

    // Also get count of active demo questions
    const { count: activeCount } = await supabase
      .from('demo_questions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get count of approved questions referenced by demo questions
    const { count: publishedCount } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .in('id', demoQuestions?.map(dq => dq.question_id) || []);

    return NextResponse.json({
      total_demo_questions: demoQuestions?.length || 0,
      active_demo_questions: activeCount || 0,
      published_referenced_questions: publishedCount || 0,
      demo_questions: demoQuestions || [],
    });

  } catch (error) {
    console.error('Unexpected error in debug demo questions API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error },
      { status: 500 }
    );
  }
}
