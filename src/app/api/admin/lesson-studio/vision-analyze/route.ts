import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/shared/config/ai-models";
import { analyzeImages } from "../generate-sequence/vision";
import type { ImageInput } from "../generate-sequence/prompt";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { image } = (await request.json()) as { image: ImageInput };

    if (!image?.url) {
      return NextResponse.json({ error: "image.url is required" }, { status: 400 });
    }

    const apiKey = getApiKey("llama");
    if (!apiKey) {
      return NextResponse.json({ error: "Llama API key not configured" }, { status: 500 });
    }

    const [result] = await analyzeImages([image], apiKey);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
