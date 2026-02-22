import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/shared/config/ai-models";
import { analyzeSingleImageWithDebug } from "../generate-sequence/vision";
import type { ImageInput } from "../generate-sequence/prompt";

export const maxDuration = 30;

/**
 * @swagger
 * /api/admin/lesson-studio/vision-analyze:
 *   post:
 *     summary: Analyze a single image using AI vision
 *     description: Performs AI vision analysis on a single pathology image to extract visual features, regions of interest, and annotations. This is used in the lesson studio for debugging and testing vision analysis before generating full sequences. Requires admin or creator role.
 *     tags:
 *       - Admin - Lesson Studio
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: object
 *                 required:
 *                   - url
 *                   - title
 *                   - description
 *                   - category
 *                   - width
 *                   - height
 *                 properties:
 *                   url:
 *                     type: string
 *                     format: uri
 *                     description: URL of the image to analyze
 *                   title:
 *                     type: string
 *                     description: Title of the image
 *                   description:
 *                     type: string
 *                     description: Description of the image content
 *                   category:
 *                     type: string
 *                     enum: [microscopic, gross, figure, table]
 *                     description: Category of the pathology image
 *                   magnification:
 *                     type: string
 *                     enum: [low, medium, high, very_high]
 *                     nullable: true
 *                     description: Microscopic magnification level (guides annotation strategy)
 *                   width:
 *                     type: integer
 *                     description: Image width in pixels
 *                   height:
 *                     type: integer
 *                     description: Image height in pixels
 *     responses:
 *       200:
 *         description: Image analyzed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: object
 *                   description: Vision analysis results including detected features and regions
 *                 debug:
 *                   type: object
 *                   description: Debug information about the analysis process
 *       400:
 *         description: Bad request - missing or invalid image.url
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - admin or creator access required
 *       500:
 *         description: Internal server error - API key not configured or analysis failed
 */
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

    const { result, debug } = await analyzeSingleImageWithDebug(image, apiKey);

    return NextResponse.json({ success: true, result, debug });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
