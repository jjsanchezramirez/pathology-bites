// src/app/api/questions/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/services/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin or creator role for bulk export
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !['admin', 'creator'].includes(userData?.role)) {
      return NextResponse.json({ 
        error: 'Forbidden - Admin or Creator access required for bulk export' 
      }, { status: 403 });
    }

    // Get query parameters for filtering
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const difficulty = url.searchParams.get('difficulty');
    const questionSetId = url.searchParams.get('question_set_id');
    const categoryId = url.searchParams.get('category_id');

    // Build the query
    let query = supabase
      .from('questions')
      .select(`
        id,
        title,
        stem,
        difficulty,
        teaching_point,
        question_references,
        status,
        question_set_id,
        category_id,
        created_at,
        updated_at,
        question_options(
          text,
          is_correct,
          explanation,
          order_index
        ),
        question_images(
          question_section,
          order_index,
          image:images(
            id,
            url,
            alt_text,
            description
          )
        ),
        question_tags(
          tag:tags(
            id,
            name
          )
        ),
        question_set:sets(
          id,
          name,
          source_type,
          short_form
        ),
        category:categories(
          id,
          name,
          parent_id
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (difficulty && difficulty !== 'all') {
      query = query.eq('difficulty', difficulty);
    }
    if (questionSetId && questionSetId !== 'all') {
      query = query.eq('question_set_id', questionSetId);
    }
    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId);
    }

    const { data: questions, error: questionsError } = await query;

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    // Transform the data to match the import format
    const exportData = {
      export_info: {
        generated_at: new Date().toISOString(),
        generated_by: user.id,
        total_questions: questions?.length || 0,
        filters_applied: {
          status: status || 'all',
          difficulty: difficulty || 'all',
          question_set_id: questionSetId || 'all',
          category_id: categoryId || 'all'
        }
      },
      questions: questions?.map((question: any) => ({
        title: question.title,
        stem: question.stem,
        difficulty: question.difficulty,
        teaching_point: question.teaching_point,
        question_references: question.question_references,
        status: question.status,
        question_set_id: question.question_set_id,
        category_id: question.category_id,
        
        // Transform answer options to match import format
        answer_options: question.question_options?.map((option: any) => ({
          text: option.text,
          is_correct: option.is_correct,
          explanation: option.explanation || '',
          order_index: option.order_index
        })) || [],

        // Transform question images to include image data
        question_images: question.question_images?.map((qi: any) => ({
          question_section: qi.question_section,
          order_index: qi.order_index,
          image_url: qi.image?.url,
          alt_text: qi.image?.alt_text,
          caption: qi.image?.description
        })) || [],

        // Include tag IDs for import compatibility
        tag_ids: question.question_tags?.map((qt: any) => qt.tag.id) || [],

        // Include metadata for reference
        metadata: {
          original_id: question.id,
          question_set: question.question_set && !Array.isArray(question.question_set) ? {
            id: (question.question_set as any).id,
            name: (question.question_set as any).name,
            source_type: (question.question_set as any).source_type,
            short_form: (question.question_set as any).short_form
          } : null,
          category: question.category && !Array.isArray(question.category) ? {
            id: (question.category as any).id,
            name: (question.category as any).name,
            parent_id: (question.category as any).parent_id
          } : null,
          tags: question.question_tags?.map((qt: any) => ({
            id: qt.tag.id,
            name: qt.tag.name
          })) || [],
          created_at: question.created_at,
          updated_at: question.updated_at
        }
      })) || []
    };

    return NextResponse.json(exportData);

  } catch (error) {
    console.error('Error exporting questions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
