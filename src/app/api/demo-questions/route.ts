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
  id: string;
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

interface QuestionData {
  id: string;
  title: string;
  stem: string;
  teaching_point: string;
  question_references: string | null;
  status: string;
  difficulty: string;
  answer_options: AnswerOptionData[];
  question_images: QuestionImageData[];
}

// Define interfaces for the processed response data
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
    
    // If ID is provided, fetch a specific question
    if (id) {
      // Try to fetch from demo_questions view first
      const { data, error } = await supabase
        .from('demo_questions')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        // If view doesn't exist, try direct query to questions table
        const { data: directData, error: directError } = await supabase
          .from('questions')
          .select(`
            id,
            title,
            stem,
            teaching_point,
            question_references,
            status,
            difficulty,
            answer_options(
              id,
              text,
              is_correct,
              explanation
            ),
            question_images(
              id,
              image_id,
              question_section,
              order_index,
              image:images(
                id,
                url,
                alt_text,
                description
              )
            )
          `)
          .eq('id', id)
          .eq('status', 'published')
          .single();
        
        if (directError || !directData) {
          console.error('Error fetching question:', directError);
          return NextResponse.json(
            { error: 'Demo question not found' },
            { status: 404 }
          );
        }
        
        try {
          const typedData = directData as unknown as QuestionData;
          
          // Process the direct data to match expected format
          const stemImages: QuestionImage[] = typedData.question_images
            .filter((img: QuestionImageData) => img.question_section === 'stem')
            .sort((a: QuestionImageData, b: QuestionImageData) => a.order_index - b.order_index)
            .map((img: QuestionImageData) => ({
              url: img.image?.[0]?.url || '',
              alt: img.image?.[0]?.alt_text || '',
              caption: img.image?.[0]?.description || ''
            }));
          
          // Get explanation image
          const explanationImages: QuestionImage[] = typedData.question_images
            .filter((img: QuestionImageData) => img.question_section === 'explanation')
            .sort((a: QuestionImageData, b: QuestionImageData) => a.order_index - b.order_index)
            .map((img: QuestionImageData) => ({
              url: img.image?.[0]?.url || '',
              alt: img.image?.[0]?.alt_text || '',
              caption: img.image?.[0]?.description || ''
            }));
          
          const explanationImage: QuestionImage | null = explanationImages.length > 0 ? explanationImages[0] : null;
          
          // Process options
          const options: QuestionOption[] = typedData.answer_options.map((opt: AnswerOptionData) => ({
            id: opt.id || '',
            text: opt.text || '',
            correct: !!opt.is_correct,
            explanation: opt.explanation || null
          }));
          
          // Build incorrect explanations object
          const incorrectExplanations: Record<string, string> = {};
          typedData.answer_options.forEach((opt: AnswerOptionData) => {
            if (!opt.is_correct && opt.explanation) {
              incorrectExplanations[opt.id] = opt.explanation;
            }
          });
          
          // Parse references
          const references: string[] = typedData.question_references ? 
            typedData.question_references.split('\n').filter((r: string) => r.trim() !== '') : 
            [];
          
          const processedQuestion: ProcessedQuestion = {
            id: typedData.id || '',
            title: typedData.title || '',
            body: typedData.stem || '',
            teachingPoint: typedData.teaching_point || '',
            images: stemImages,
            options: options,
            incorrectExplanations: incorrectExplanations,
            references: references,
            comparativeImage: explanationImage
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
      
      return NextResponse.json(data, { status: 200 });
    } 
    // If no ID is provided, return a random demo question
    else {
      // Try to fetch from demo_questions view first
      const { data, error } = await supabase
        .from('demo_questions')
        .select('*')
        .eq('status', 'published')
        .limit(10);  // Get a small set to choose from randomly
      
      if (error || !data || data.length === 0) {
        // If view doesn't exist or no data, try direct query to questions table
        const { data: directData, error: directError } = await supabase
          .from('questions')
          .select(`
            id,
            title,
            stem,
            teaching_point,
            question_references,
            status,
            difficulty,
            answer_options(
              id,
              text,
              is_correct,
              explanation
            ),
            question_images(
              id,
              image_id,
              question_section,
              order_index,
              image:images(
                id,
                url,
                alt_text,
                description
              )
            )
          `)
          .eq('status', 'published')
          .limit(10);  // Get a small set to choose from randomly
        
        if (directError || !directData || directData.length === 0) {
          return NextResponse.json(
            { error: 'No demo questions available' },
            { status: 404 }
          );
        }
        
        try {
          // Select a random question from the results
          const randomIndex = Math.floor(Math.random() * directData.length);
          const randomQuestion = directData[randomIndex] as unknown as QuestionData;
          
          // Process the direct data to match expected format (same as above)
          const stemImages: QuestionImage[] = randomQuestion.question_images
            .filter((img: QuestionImageData) => img.question_section === 'stem')
            .sort((a: QuestionImageData, b: QuestionImageData) => a.order_index - b.order_index)
            .map((img: QuestionImageData) => ({
              url: img.image?.[0]?.url || '',
              alt: img.image?.[0]?.alt_text || '',
              caption: img.image?.[0]?.description || ''
            }));
          
          // Get explanation image
          const explanationImages: QuestionImage[] = randomQuestion.question_images
            .filter((img: QuestionImageData) => img.question_section === 'explanation')
            .sort((a: QuestionImageData, b: QuestionImageData) => a.order_index - b.order_index)
            .map((img: QuestionImageData) => ({
              url: img.image?.[0]?.url || '',
              alt: img.image?.[0]?.alt_text || '',
              caption: img.image?.[0]?.description || ''
            }));
          
          const explanationImage: QuestionImage | null = explanationImages.length > 0 ? explanationImages[0] : null;
          
          // Process options
          const options: QuestionOption[] = randomQuestion.answer_options.map((opt: AnswerOptionData) => ({
            id: opt.id || '',
            text: opt.text || '',
            correct: !!opt.is_correct,
            explanation: opt.explanation || null
          }));
          
          // Build incorrect explanations object
          const incorrectExplanations: Record<string, string> = {};
          randomQuestion.answer_options.forEach((opt: AnswerOptionData) => {
            if (!opt.is_correct && opt.explanation) {
              incorrectExplanations[opt.id] = opt.explanation;
            }
          });
          
          // Parse references
          const references: string[] = randomQuestion.question_references ? 
            randomQuestion.question_references.split('\n').filter((r: string) => r.trim() !== '') : 
            [];
          
          const processedQuestion: ProcessedQuestion = {
            id: randomQuestion.id || '',
            title: randomQuestion.title || '',
            body: randomQuestion.stem || '',
            teachingPoint: randomQuestion.teaching_point || '',
            images: stemImages,
            options: options,
            incorrectExplanations: incorrectExplanations,
            references: references,
            comparativeImage: explanationImage
          };
          
          return NextResponse.json(processedQuestion, { status: 200 });
        } catch (processingError) {
          console.error('Error processing random question data:', processingError);
          return NextResponse.json(
            { error: 'Error processing question data' },
            { status: 500 }
          );
        }
      }
      
      // Select a random question from the results
      const randomIndex = Math.floor(Math.random() * data.length);
      return NextResponse.json(data[randomIndex], { status: 200 });
    }
  } catch (error) {
    console.error('Unexpected error in demo question API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}