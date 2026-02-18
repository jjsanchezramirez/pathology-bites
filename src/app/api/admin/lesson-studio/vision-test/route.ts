import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/shared/config/ai-models";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, title, description, category, model } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const apiKey = getApiKey("llama");
    if (!apiKey) {
      return NextResponse.json({ error: "Llama API key not configured" }, { status: 500 });
    }

    const selectedModel = model || "Llama-4-Scout-17B-16E-Instruct-FP8";

    const userMessage = {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: imageUrl },
        },
        {
          type: "text",
          text: `This is a pathology image with the following metadata:
- Title: ${title || "(none)"}
- Description: ${description || "(none)"}
- Category: ${category || "(none)"}

Please analyze the image and answer each question on its own line:
1. Can you actually see and interpret this image? (yes/no, then brief reason)
2. What do you see? Describe the key visual features you observe.
3. Where are the most salient features located? Describe in terms of image position (top-left, centre, etc.).
4. Annotation placement: if placing a spotlight circle or text label on the single most important feature, give the EXACT position as: x=<number>, y=<number> (where 0,0 is top-left and 100,100 is bottom-right). Then explain why.
5. Suggested text label for a text overlay on this image (5 words or fewer).`,
        },
      ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch("https://api.llama.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: "system",
              content:
                "You are an expert pathologist with strong visual analysis skills. Be precise and honest — if you cannot see the image, say so clearly.",
            },
            userMessage,
          ],
          max_completion_tokens: 800,
          temperature: 0.2,
        }),
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Timeout after 25 seconds");
      }
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      let msg = `Llama API error: ${response.status}`;
      try {
        const err = JSON.parse(errorText);
        if (err.error?.message) msg = err.error.message;
      } catch {
        /* use default */
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const data = await response.json();
    const content =
      data.completion_message?.content?.text || data.choices?.[0]?.message?.content || "";

    return NextResponse.json({
      success: true,
      model: selectedModel,
      response: content,
      raw: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
