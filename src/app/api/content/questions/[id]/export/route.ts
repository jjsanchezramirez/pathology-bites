// src/app/api/questions/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/shared/services/server';
import { createOptimizedResponse, optimizedAuth } from '@/shared/services/egress-optimization';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const supabase = await createClient();

    // Use optimized auth to reduce egress
    const authResult = await optimizedAuth();
    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = authResult.user;

    // Fetch the complete question data with all associated materials
    const { data: question, error: questionError } = await supabase
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
        question_set:question_sets(
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
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Transform the data to match the import format
    const exportData = {
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
        exported_at: new Date().toISOString(),
        exported_by: user.id,
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
    };

    // Return optimized response with compression for large question data
    return createOptimizedResponse(exportData, {
      compress: true,
      cache: {
        maxAge: 1800, // 30 minutes cache for question exports
        staleWhileRevalidate: 300,
        public: false
      }
    });

  } catch (error) {
    console.error('Error exporting question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
