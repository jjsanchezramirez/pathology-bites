import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/services/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to submit questions for review
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !['admin', 'creator'].includes(userData?.role)) {
      return NextResponse.json({ 
        error: 'Forbidden - Creator or Admin access required' 
      }, { status: 403 });
    }

    // Check if question exists and is in draft status
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, status, created_by')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Check if user owns the question or is admin
    if (question.created_by !== user.id && userData?.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden - You can only submit your own questions for review' 
      }, { status: 403 });
    }

    // Check if question is in draft status (only draft questions can be submitted for review)
    if (question.status !== 'draft') {
      return NextResponse.json({
        error: `Question cannot be submitted for review. Current status: ${question.status}. Only draft questions can be submitted.`
      }, { status: 400 });
    }

    // Validate that question has required fields for review
    const { data: questionDetails, error: detailsError } = await supabase
      .from('questions')
      .select(`
        title,
        stem,
        difficulty,
        teaching_point,
        question_options(*),
        question_images(*)
      `)
      .eq('id', questionId)
      .single();

    if (detailsError || !questionDetails) {
      return NextResponse.json({ 
        error: 'Failed to validate question details' 
      }, { status: 500 });
    }

    // Validate required fields
    const validationErrors = [];
    
    if (!questionDetails.title?.trim()) {
      validationErrors.push('Title is required');
    }
    
    if (!questionDetails.stem?.trim()) {
      validationErrors.push('Question stem is required');
    }
    
    if (!questionDetails.teaching_point?.trim()) {
      validationErrors.push('Teaching point is required');
    }
    
    if (!questionDetails.question_options || questionDetails.question_options.length < 2) {
      validationErrors.push('At least 2 answer options are required');
    }
    
    // Check if there's exactly one correct answer
    const correctAnswers = questionDetails.question_options?.filter(opt => opt.is_correct) || [];
    if (correctAnswers.length !== 1) {
      validationErrors.push('Exactly one correct answer is required');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Question validation failed',
        details: validationErrors
      }, { status: 400 });
    }

    // Update question status to pending (simplified from under_review)
    const { error: updateError } = await supabase
      .from('questions')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', questionId);

    if (updateError) {
      console.error('Error updating question status:', updateError);
      return NextResponse.json({ 
        error: 'Failed to submit question for review' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Question submitted for review successfully',
      questionId,
      newStatus: 'pending'
    });

  } catch (error) {
    console.error('Error in submit for review API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
