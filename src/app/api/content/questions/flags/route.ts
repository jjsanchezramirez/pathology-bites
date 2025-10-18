import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/services/server';

// Hard-coded flag threshold - questions are removed from circulation after this many flags
const FLAG_THRESHOLD = 1;

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
        description: description ? description.trim() : null,
        status: 'open'
      })
      .select()
      .single();

    if (flagError) {
      console.error('Error creating flag:', flagError);
      return NextResponse.json({ error: 'Failed to flag question' }, { status: 500 });
    }

    // Check total number of open flags for this question
    const { data: openFlags, error: countError } = await supabase
      .from('question_flags')
      .select('id', { count: 'exact' })
      .eq('question_id', question_id)
      .eq('status', 'open');

    if (countError) {
      console.error('Error counting flags:', countError);
      // Continue anyway - flag was created successfully
    }

    const flagCount = openFlags?.length || 1;

    // If flag count meets or exceeds threshold, remove question from circulation
    if (flagCount >= FLAG_THRESHOLD) {
      // Get current question to check its status
      const { data: currentQuestion } = await supabase
        .from('questions')
        .select('status')
        .eq('id', question_id)
        .single();

      // Only change status if question is currently published
      // Don't change if it's already draft, pending_review, or rejected
      if (currentQuestion && currentQuestion.status === 'published') {
        // Change question status to 'draft' (back to creator's queue)
        const { error: statusError } = await supabase
          .from('questions')
          .update({
            status: 'draft',
            updated_at: new Date().toISOString()
          })
          .eq('id', question_id);

        if (statusError) {
          console.error('Error updating question status:', statusError);
          // Continue anyway - flag was created successfully
        }

        // Create a question_review record to track this action
        const { error: reviewError } = await supabase
          .from('question_reviews')
          .insert({
            question_id,
            reviewer_id: user.id,
            action: 'flagged',
            feedback: `Question flagged by user (${flagCount} flag${flagCount > 1 ? 's' : ''}): ${flag_type}. ${description || ''}`.trim()
          });

        if (reviewError) {
          console.error('Error creating review record:', reviewError);
          // Continue anyway - flag was created successfully
        }
      }
    }

    return NextResponse.json({
      success: true,
      flag,
      flagCount,
      threshold: FLAG_THRESHOLD,
      removedFromCirculation: flagCount >= FLAG_THRESHOLD,
      message: flagCount >= FLAG_THRESHOLD
        ? `Question flagged and removed from circulation (${flagCount}/${FLAG_THRESHOLD} flags)`
        : `Question flagged successfully (${flagCount}/${FLAG_THRESHOLD} flags)`
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
