import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/services/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or reviewer
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !['admin', 'reviewer'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin or Reviewer access required' }, { status: 403 });
    }

    const body = await request.json();
    const { question_id, action, feedback, changes_made } = body;

    // Validate required fields
    if (!question_id || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate action - SIMPLIFIED TO 3 ACTIONS
    const validActions = ['approve', 'request_changes', 'reject'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Check if question exists
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, status, version')
      .eq('id', question_id)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Determine new status based on action - SIMPLIFIED TO 4 STATUSES
    let newStatus = question.status;
    switch (action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'request_changes':
        newStatus = 'draft';
        break;
      case 'reject':
        newStatus = 'draft';
        break;
    }

    // Start a transaction
    const { data: review, error: reviewError } = await supabase
      .from('question_reviews')
      .insert({
        question_id,
        reviewer_id: user.id,
        action,
        feedback: feedback || null,
        changes_made: changes_made || null
      })
      .select()
      .single();

    if (reviewError) {
      console.error('Error creating review:', reviewError);
      return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
    }

    // Update question status
    const { error: updateError } = await supabase
      .from('questions')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', question_id);

    if (updateError) {
      console.error('Error updating question:', updateError);
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      review,
      message: `Question ${action.replace('_', ' ')} successfully`
    });

  } catch (error) {
    console.error('Error in question review API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or reviewer
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !['admin', 'reviewer'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin or Reviewer access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('question_id');

    let query = supabase
      .from('question_reviews')
      .select(`
        *,
        reviewer:users!question_reviews_reviewer_id_fkey(first_name, last_name, email),
        question:questions(title, status)
      `)
      .order('created_at', { ascending: false });

    if (questionId) {
      query = query.eq('question_id', questionId);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    return NextResponse.json({ reviews });

  } catch (error) {
    console.error('Error in question review API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
