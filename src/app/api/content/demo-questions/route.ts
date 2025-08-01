// src/app/api/demo-questions/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Define interfaces for Supabase response data
interface ImageData {
  id: string;
  url: string;
  alt_text: string;
  description: string;
}

interface QuestionImageData {
  image_id: string;
  question_section: string;
  order_index: number;
  image?: ImageData[];
}

interface AnswerOptionData {
  id: string;
  text: string;
  is_correct: boolean;
  explanation: string | null;
}

// Legacy alias for backward compatibility
interface QuestionOptionData extends AnswerOptionData {}

interface QuestionData {
  id: string;
  title: string;
  stem: string;
  teaching_point: string;
  question_references: string | null;
  status: string;
  difficulty: string;
  question_options?: QuestionOptionData[];
  answer_options?: AnswerOptionData[]; // Legacy field for backward compatibility
  question_images: QuestionImageData[];
}

interface QuestionImage {
  url: string;
  alt: string;
  caption: string;
}

interface QuestionOption {
  id: string;
  text: string;
  correct: boolean;
  explanation: string | null;
}

interface ProcessedQuestion {
  id: string;
  title: string;
  body: string;
  teachingPoint: string;
  images: QuestionImage[];
  options: QuestionOption[];
  incorrectExplanations: Record<string, string>;
  references: string[];
  comparativeImage: QuestionImage | null;
}

export async function GET(request: Request) {
  try {
    // Get URL to check for query parameters
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // If ID is provided, fetch a specific demo question
    if (id) {
      // Query demo_questions table to get the question_id, then fetch full question data
      const { data: demoData, error: demoError } = await supabase
        .from('demo_questions')
        .select('question_id')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (demoError || !demoData) {
        console.error('Error fetching demo question:', demoError);
        return NextResponse.json(
          { error: 'Demo question not found' },
          { status: 404 }
        );
      }

      // Fetch the full question data
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select(`
          id,
          title,
          stem,
          teaching_point,
          question_references,
          status,
          difficulty
        `)
        .eq('id', demoData.question_id)
        .eq('status', 'approved')
        .single();

      if (questionError || !questionData) {
        console.error('Error fetching question data:', questionError);
        return NextResponse.json(
          { error: 'Question data not found' },
          { status: 404 }
        );
      }

      // Fetch question options separately
      const { data: answerOptions, error: optionsError } = await supabase
        .from('question_options')
        .select('id, text, is_correct, explanation')
        .eq('question_id', demoData.question_id)
        .order('order_index');

      // Fetch question images with a simpler query
      const { data: questionImages, error: imagesError } = await supabase
        .from('question_images')
        .select('image_id, question_section, order_index')
        .eq('question_id', demoData.question_id)
        .order('order_index');

      // Fetch image details separately
      let imageDetails: any[] = [];
      if (questionImages && questionImages.length > 0) {
        const imageIds = questionImages.map((qi: any) => qi.image_id);
        const { data: images, error: imageError } = await supabase
          .from('images')
          .select('id, url, alt_text, description')
          .in('id', imageIds);
        imageDetails = images || [];
      }

      try {
        // Process the question data to match expected format
        const stemImages = questionImages
          ?.filter((qi: any) => qi.question_section === 'stem')
          ?.sort((a: any, b: any) => a.order_index - b.order_index)
          ?.map((qi: any) => {
            const imageDetail = imageDetails.find((img: any) => img.id === qi.image_id);
            return {
              url: imageDetail?.url || '',
              caption: imageDetail?.description || '',
              alt: imageDetail?.alt_text || 'Question image'
            };
          }) || [];

        const explanationImageData = questionImages
          ?.find((qi: any) => qi.question_section === 'explanation');
        const explanationImageDetail = explanationImageData ?
          imageDetails.find((img: any) => img.id === explanationImageData.image_id) : null;

        const processedQuestion = {
          id: questionData.id,
          title: questionData.title,
          body: questionData.stem,
          images: stemImages,
          options: answerOptions?.map((option: any) => ({
            id: option.id,
            text: option.text,
            correct: option.is_correct,
            explanation: option.explanation
          })) || [],
          teachingPoint: questionData.teaching_point,
          incorrectExplanations: answerOptions?.reduce((acc: Record<string, string>, option: any) => {
            if (!option.is_correct && option.explanation) {
              acc[option.id] = option.explanation;
            }
            return acc;
          }, {}) || {},
          references: questionData.question_references ? [questionData.question_references] : [],
          comparativeImage: explanationImageDetail ? {
            url: explanationImageDetail.url || '',
            caption: explanationImageDetail.description || '',
            alt: explanationImageDetail.alt_text || 'Comparative image'
          } : undefined
        };

        return NextResponse.json(processedQuestion, { status: 200 });
      } catch (processingError) {
        console.error('Error processing question data:', processingError);
        return NextResponse.json(
          { error: 'Error processing question data' },
          { status: 500 }
        );
      }
    }
    // If no ID is provided, return a random demo question
    else {
      // Get current index from query parameter or default to 0
      const currentIndex = parseInt(url.searchParams.get('index') || '0');

      // Get all active demo questions ordered by display_order
      const { data: demoQuestions, error: demoError } = await supabase
        .from('demo_questions')
        .select('id, question_id, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (demoError || !demoQuestions || demoQuestions.length === 0) {
        console.error('Error fetching demo questions:', demoError);
        return NextResponse.json(
          { error: 'No demo questions available. Please add questions to the demo_questions table.' },
          { status: 404 }
        );
      }

      // Use sequential ordering instead of random selection
      const selectedIndex = currentIndex % demoQuestions.length;
      const selectedDemo = demoQuestions[selectedIndex];

      // Include next index in response for client to track
      const nextIndex = (selectedIndex + 1) % demoQuestions.length;

      // Fetch the basic question data
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('id, title, stem, teaching_point, question_references, status, difficulty')
        .eq('id', selectedDemo.question_id)
        .eq('status', 'approved')
        .single();

      if (questionError || !questionData) {
        console.error('Error fetching question data:', questionError);
        return NextResponse.json(
          { error: 'Question data not found' },
          { status: 404 }
        );
      }

      // Fetch question options separately
      const { data: answerOptions, error: optionsError } = await supabase
        .from('question_options')
        .select('id, text, is_correct, explanation')
        .eq('question_id', selectedDemo.question_id)
        .order('order_index');

      // Fetch question images with a simpler query
      const { data: questionImages, error: imagesError } = await supabase
        .from('question_images')
        .select('image_id, question_section, order_index')
        .eq('question_id', selectedDemo.question_id)
        .order('order_index');

      // Fetch image details separately
      let imageDetails: any[] = [];
      if (questionImages && questionImages.length > 0) {
        const imageIds = questionImages.map((qi: any) => qi.image_id);
        const { data: images } = await supabase
          .from('images')
          .select('id, url, alt_text, description')
          .in('id', imageIds);
        imageDetails = images || [];
      }

      try {
        // Process the question data to match expected format
        const stemImages = questionImages
          ?.filter((qi: any) => qi.question_section === 'stem')
          ?.sort((a: any, b: any) => a.order_index - b.order_index)
          ?.map((qi: any) => {
            const imageDetail = imageDetails.find((img: any) => img.id === qi.image_id);
            return {
              url: imageDetail?.url || '',
              caption: imageDetail?.description || '',
              alt: imageDetail?.alt_text || 'Question image'
            };
          }) || [];

        const explanationImageData = questionImages
          ?.find((qi: any) => qi.question_section === 'explanation');
        const explanationImageDetail = explanationImageData ?
          imageDetails.find((img: any) => img.id === explanationImageData.image_id) : null;

        const processedQuestion = {
          id: questionData.id,
          title: questionData.title,
          body: questionData.stem,
          images: stemImages,
          options: answerOptions?.map((option: any) => ({
            id: option.id,
            text: option.text,
            correct: option.is_correct,
            explanation: option.explanation
          })) || [],
          teachingPoint: questionData.teaching_point,
          incorrectExplanations: answerOptions?.reduce((acc: Record<string, string>, option: any) => {
            if (!option.is_correct && option.explanation) {
              acc[option.id] = option.explanation;
            }
            return acc;
          }, {}) || {},
          references: questionData.question_references ? [questionData.question_references] : [],
          comparativeImage: explanationImageDetail ? {
            url: explanationImageDetail.url || '',
            caption: explanationImageDetail.description || '',
            alt: explanationImageDetail.alt_text || 'Comparative image'
          } : undefined,
          // Include metadata for sequential ordering
          _metadata: {
            currentIndex: selectedIndex,
            nextIndex: nextIndex,
            totalQuestions: demoQuestions.length
          }
        };

        return NextResponse.json(processedQuestion, { status: 200 });
      } catch (processingError) {
        console.error('Error processing question data:', processingError);
        return NextResponse.json(
          { error: 'Error processing question data' },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('Unexpected error in demo question API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}