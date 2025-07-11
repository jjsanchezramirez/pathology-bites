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

    const body = await request.json();
    const { question_id, flag_type, description } = body;

    // Validate required fields
    if (!question_id || !flag_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate flag type
    const validFlagTypes = [
      'incorrect_answer',
      'unclear_question',
      'outdated_content',
      'incorrect_explanations',
      'other'
    ];
    if (!validFlagTypes.includes(flag_type)) {
      return NextResponse.json({ error: 'Invalid flag type' }, { status: 400 });
    }

    // Check if question exists and is published
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, status')
      .eq('id', question_id)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (question.status !== 'published') {
      return NextResponse.json({ error: 'Only published questions can be flagged' }, { status: 400 });
    }

    // Check if user has already flagged this question
    const { data: existingFlag, error: checkError } = await supabase
      .from('question_flags')
      .select('id')
      .eq('question_id', question_id)
      .eq('flagged_by', user.id)
      .eq('status', 'pending')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing flags:', checkError);
      return NextResponse.json({ error: 'Failed to check existing flags' }, { status: 500 });
    }

    if (existingFlag) {
      return NextResponse.json({ error: 'You have already flagged this question' }, { status: 400 });
    }

    // Create flag record
    const { data: flag, error: flagError } = await supabase
      .from('question_flags')
      .insert({
        question_id,
        flagged_by: user.id,
        flag_type,
        description: description ? description.trim() : null
      })
      .select()
      .single();

    if (flagError) {
      console.error('Error creating flag:', flagError);
      return NextResponse.json({ error: 'Failed to flag question' }, { status: 500 });
    }

    // Update question flag metadata (handled by trigger)
    // No need to change question status - flags are now metadata

    return NextResponse.json({ 
      success: true, 
      flag,
      message: 'Question flagged successfully'
    });

  } catch (error) {
    console.error('Error in question flag API:', error);
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

    // Check if user is admin or reviewer (for viewing all flags) or regular user (for their own flags)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: 'Failed to check user role' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('question_id');
    const status = searchParams.get('status');

    let query = supabase
      .from('question_flags')
      .select(`
        *,
        flagged_by_user:users!question_flags_flagged_by_fkey(first_name, last_name, email),
        resolved_by_user:users!question_flags_resolved_by_fkey(first_name, last_name, email),
        question:questions(title, status)
      `)
      .order('created_at', { ascending: false });

    // If user is not admin or reviewer, only show their own flags
    if (!['admin', 'reviewer'].includes(userData?.role)) {
      query = query.eq('flagged_by', user.id);
    }

    if (questionId) {
      query = query.eq('question_id', questionId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: flags, error } = await query;

    if (error) {
      console.error('Error fetching flags:', error);
      return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
    }

    return NextResponse.json({ flags });

  } catch (error) {
    console.error('Error in question flag API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const { flag_id, status, resolution_notes } = body;

    // Validate required fields
    if (!flag_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate status - SIMPLIFIED
    const validStatuses = ['open', 'closed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Update flag
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'closed') {
      updateData.resolved_by = user.id;
      updateData.resolved_at = new Date().toISOString();
      updateData.resolution_notes = resolution_notes || null;
      // Determine resolution type based on whether notes indicate a fix
      updateData.resolution_type = resolution_notes && resolution_notes.trim() ? 'fixed' : 'dismissed';
    }

    const { data: flag, error: updateError } = await supabase
      .from('question_flags')
      .update(updateData)
      .eq('id', flag_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating flag:', updateError);
      return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      flag,
      message: `Flag ${status} successfully`
    });

  } catch (error) {
    console.error('Error in question flag API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
