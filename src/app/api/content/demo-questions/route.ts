// src/app/api/content/demo-questions/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side cache for demo questions with 24-hour TTL
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
interface CachedDemoQuestion {
  data: ProcessedQuestion;
  timestamp: number;
}
const demoQuestionsCache = new Map<number, CachedDemoQuestion>();
let cachedQuestionsList: { id: string; question_id: string; display_order: number }[] | null = null;
let questionsListTimestamp: number = 0;

// Define interfaces for Supabase response data
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
    const id = url.searchParams.get("id");

    // Initialize Supabase client with service role for demo questions (public access)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If ID is provided, fetch a specific demo question
    if (id) {
      // Query demo_questions table to get the question_id, then fetch full question data
      const { data: demoData, error: demoError } = await supabase
        .from("demo_questions")
        .select("question_id")
        .eq("id", id)
        .eq("is_active", true)
        .single();

      if (demoError || !demoData) {
        console.error("Error fetching demo question:", demoError);
        return NextResponse.json({ error: "Demo question not found" }, { status: 404 });
      }

      // Consolidated query to fetch all question data in parallel
      const [
        { data: questionData, error: questionError },
        { data: answerOptions, error: optionsError },
        { data: questionImagesWithDetails },
      ] = await Promise.all([
        // Get question data
        supabase
          .from("questions")
          .select(
            `
            id,
            title,
            stem,
            teaching_point,
            question_references,
            status,
            difficulty
          `
          )
          .eq("id", demoData.question_id)
          .eq("status", "published")
          .single(),

        // Get answer options
        supabase
          .from("question_options")
          .select("id, text, is_correct, explanation")
          .eq("question_id", demoData.question_id)
          .order("order_index"),

        // Get question images with image details in one query
        supabase
          .from("question_images")
          .select(
            `
            image_id,
            question_section,
            order_index,
            images:image_id (
              id,
              url,
              alt_text,
              description
            )
          `
          )
          .eq("question_id", demoData.question_id)
          .order("order_index"),
      ]);

      if (questionError || !questionData) {
        console.error("Error fetching question data:", questionError);
        return NextResponse.json({ error: "Question data not found" }, { status: 404 });
      }

      if (optionsError) {
        console.error("Error fetching question options:", optionsError);
        return NextResponse.json({ error: "Question options not found" }, { status: 404 });
      }

      try {
        // Process the question data to match expected format
        const stemImages =
          questionImagesWithDetails
            ?.filter((qi: unknown) => qi.question_section === "stem")
            ?.sort((a: unknown, b: unknown) => a.order_index - b.order_index)
            ?.map((qi: unknown) => {
              const imageDetail = Array.isArray(qi.images) ? qi.images[0] : qi.images;
              return {
                url: imageDetail?.url || "",
                caption: imageDetail?.description || "",
                alt: imageDetail?.alt_text || "Question image",
              };
            }) || [];

        const explanationImageData = questionImagesWithDetails?.find(
          (qi: unknown) => qi.question_section === "explanation"
        );
        const explanationImageDetail = Array.isArray(explanationImageData?.images)
          ? explanationImageData?.images[0]
          : explanationImageData?.images;

        const processedQuestion = {
          id: questionData.id,
          title: questionData.title,
          body: questionData.stem,
          images: stemImages,
          options:
            answerOptions?.map((option: unknown) => ({
              id: option.id,
              text: option.text,
              correct: option.is_correct,
              explanation: option.explanation,
            })) || [],
          teachingPoint: questionData.teaching_point,
          incorrectExplanations:
            answerOptions?.reduce((acc: Record<string, string>, option: unknown) => {
              if (!option.is_correct && option.explanation) {
                acc[option.id] = option.explanation;
              }
              return acc;
            }, {}) || {},
          references: questionData.question_references ? [questionData.question_references] : [],
          comparativeImage: explanationImageDetail
            ? {
                url: explanationImageDetail.url || "",
                caption: explanationImageDetail.description || "",
                alt: explanationImageDetail.alt_text || "Comparative image",
              }
            : null,
        };

        return NextResponse.json(processedQuestion, {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=300', // 24h cache
          },
        });
      } catch (processingError) {
        console.error("Error processing question data:", processingError);
        return NextResponse.json({ error: "Error processing question data" }, { status: 500 });
      }
    }
    // If no ID is provided, return a sequential demo question with caching
    else {
      const now = Date.now();
      const currentIndex = parseInt(url.searchParams.get("index") || "0");

      // Check if we have a cached version of the questions list
      if (!cachedQuestionsList || now - questionsListTimestamp >= CACHE_TTL) {
        console.log("[Demo Questions] Cache miss for questions list, fetching from database...");
        const { data: demoQuestions, error: demoError } = await supabase
          .from("demo_questions")
          .select("id, question_id, display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (demoError || !demoQuestions || demoQuestions.length === 0) {
          console.error("[Demo Questions] Error fetching demo questions:", demoError);
          return NextResponse.json(
            {
              error:
                "No demo questions available. Please add questions to the demo_questions table.",
            },
            { status: 404 }
          );
        }

        console.log(`[Demo Questions] Loaded ${demoQuestions.length} demo questions`);
        cachedQuestionsList = demoQuestions;
        questionsListTimestamp = now;
      }

      const demoQuestions = cachedQuestionsList!;
      const selectedIndex = currentIndex % demoQuestions.length;
      const nextIndex = (selectedIndex + 1) % demoQuestions.length;

      // Check if we have a cached version of this question
      const cachedQuestion = demoQuestionsCache.get(selectedIndex);
      if (cachedQuestion && now - cachedQuestion.timestamp < CACHE_TTL) {
        console.log(`[Demo Questions] Returning cached question index ${selectedIndex}`);
        // Return cached question with updated metadata
        return NextResponse.json(
          {
            ...cachedQuestion.data,
            _metadata: {
              currentIndex: selectedIndex,
              nextIndex: nextIndex,
              totalQuestions: demoQuestions.length,
              cached: true,
            },
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=300', // 24h cache
            },
          }
        );
      }

      console.log(
        `[Demo Questions] Cache miss for question index ${selectedIndex}, fetching from database...`
      );

      const selectedDemo = demoQuestions[selectedIndex];

      // Fetch fresh question data
      const [
        { data: questionData, error: questionError },
        { data: answerOptions, error: optionsError },
        { data: questionImagesWithDetails },
      ] = await Promise.all([
        supabase
          .from("questions")
          .select("id, title, stem, teaching_point, question_references, status, difficulty")
          .eq("id", selectedDemo.question_id)
          .eq("status", "published")
          .single(),
        supabase
          .from("question_options")
          .select("id, text, is_correct, explanation")
          .eq("question_id", selectedDemo.question_id)
          .order("order_index"),
        supabase
          .from("question_images")
          .select(
            `
            image_id,
            question_section,
            order_index,
            images:image_id (
              id,
              url,
              alt_text,
              description
            )
          `
          )
          .eq("question_id", selectedDemo.question_id)
          .order("order_index"),
      ]);

      if (questionError || !questionData) {
        console.error("Error fetching question data:", questionError);
        return NextResponse.json({ error: "Question data not found" }, { status: 404 });
      }

      if (optionsError) {
        console.error("Error fetching question options:", optionsError);
        return NextResponse.json({ error: "Question options not found" }, { status: 404 });
      }

      try {
        const stemImages =
          questionImagesWithDetails
            ?.filter((qi: unknown) => qi.question_section === "stem")
            ?.sort((a: unknown, b: unknown) => a.order_index - b.order_index)
            ?.map((qi: unknown) => {
              const imageDetail = Array.isArray(qi.images) ? qi.images[0] : qi.images;
              return {
                url: imageDetail?.url || "",
                caption: imageDetail?.description || "",
                alt: imageDetail?.alt_text || "Question image",
              };
            }) || [];

        const explanationImageData = questionImagesWithDetails?.find(
          (qi: unknown) => qi.question_section === "explanation"
        );
        const explanationImageDetail = Array.isArray(explanationImageData?.images)
          ? explanationImageData?.images[0]
          : explanationImageData?.images;

        const processedQuestion: ProcessedQuestion = {
          id: questionData.id,
          title: questionData.title,
          body: questionData.stem,
          images: stemImages,
          options:
            answerOptions?.map((option: unknown) => ({
              id: option.id,
              text: option.text,
              correct: option.is_correct,
              explanation: option.explanation,
            })) || [],
          teachingPoint: questionData.teaching_point,
          incorrectExplanations:
            answerOptions?.reduce((acc: Record<string, string>, option: unknown) => {
              if (!option.is_correct && option.explanation) {
                acc[option.id] = option.explanation;
              }
              return acc;
            }, {}) || {},
          references: questionData.question_references ? [questionData.question_references] : [],
          comparativeImage: explanationImageDetail
            ? {
                url: explanationImageDetail.url || "",
                caption: explanationImageDetail.description || "",
                alt: explanationImageDetail.alt_text || "Comparative image",
              }
            : null,
        };

        // Cache the processed question
        demoQuestionsCache.set(selectedIndex, {
          data: processedQuestion,
          timestamp: now,
        });

        return NextResponse.json(
          {
            ...processedQuestion,
            _metadata: {
              currentIndex: selectedIndex,
              nextIndex: nextIndex,
              totalQuestions: demoQuestions.length,
            },
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=300', // 24h cache
            },
          }
        );
      } catch (processingError) {
        console.error("Error processing question data:", processingError);
        return NextResponse.json({ error: "Error processing question data" }, { status: 500 });
      }
    }
  } catch (error) {
    console.error("Unexpected error in demo question API:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
