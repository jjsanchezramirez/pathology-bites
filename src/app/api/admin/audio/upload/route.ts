import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { uploadToR2, generateAudioStoragePath, deleteFromR2 } from "@/shared/services/r2-storage";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/x-m4a",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * @swagger
 * /api/admin/audio/upload:
 *   post:
 *     summary: Upload audio file
 *     description: Upload an audio file to R2 storage and create a database record. Accepts all browser-supported audio formats (MP3, M4A, WAV, WebM, OGG) up to 50MB. Files are stored in their original format. Requires admin role.
 *     tags:
 *       - Admin - Audio
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Audio file in any browser-supported format (MP3, M4A, WAV, WebM, OGG - max 50MB, stored as-is)
 *               title:
 *                 type: string
 *                 description: Title for the audio file (defaults to filename if not provided)
 *                 example: "Pulmonary Edema Explanation"
 *               description:
 *                 type: string
 *                 description: Description of the audio content
 *                 example: "Audio explanation of pulmonary edema pathophysiology"
 *               pathology_category_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the associated pathology category (optional)
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               generated_text:
 *                 type: string
 *                 description: Transcript or generated text from the audio (optional)
 *                 example: "Pulmonary edema is characterized by fluid accumulation in the alveoli..."
 *               duration_seconds:
 *                 type: number
 *                 format: float
 *                 description: Duration of the audio file in seconds (optional)
 *                 example: 125.5
 *     responses:
 *       200:
 *         description: Audio file uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 audio:
 *                   type: object
 *                   description: Created audio record with URL, storage path, metadata, and file information
 *       400:
 *         description: Bad request - no file provided, invalid file type, or file too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid file type \"audio/aac\". Allowed: MP3, M4A, WAV, WebM, OGG."
 *       401:
 *         description: Unauthorized - missing authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authentication required."
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Administrator privileges required."
 *       500:
 *         description: Internal server error - storage upload failed or database error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to upload audio to storage."
 */
export async function POST(request: NextRequest) {
  let uploadedStoragePath: string | null = null;

  try {
    const supabase = await createClient();

    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Administrator privileges required." }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type "${file.type}". Allowed: MP3, M4A, WAV, WebM, OGG.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
        },
        { status: 400 }
      );
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return NextResponse.json({ error: "Failed to read audio file." }, { status: 400 });
    }

    const storagePath = generateAudioStoragePath(file.name);
    uploadedStoragePath = storagePath;

    let uploadResult;
    try {
      uploadResult = await uploadToR2(fileBuffer, storagePath, {
        contentType: file.type,
        cacheControl: "3600",
        bucket: "pathology-bites-audio",
        metadata: {
          originalName: file.name,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("R2 audio upload failed:", error);
      uploadedStoragePath = null;
      return NextResponse.json({ error: "Failed to upload audio to storage." }, { status: 500 });
    }

    // Get metadata from form
    const title = (formData.get("title") as string) || file.name;
    const description = formData.get("description") as string | null;
    const pathology_category_id = formData.get("pathology_category_id") as string | null;
    const generated_text = formData.get("generated_text") as string | null;
    const duration_seconds = formData.get("duration_seconds") as string | null;

    const parsedDuration = duration_seconds ? parseFloat(duration_seconds) : null;

    // Insert database record
    const { data: audioData, error: dbError } = await supabase
      .from("audio")
      .insert({
        url: uploadResult.url,
        storage_path: storagePath,
        title: title.trim(),
        description: description?.trim() || null,
        pathology_category_id: pathology_category_id?.trim() || null,
        file_type: file.type,
        file_size_bytes: fileBuffer.length,
        duration_seconds: parsedDuration,
        generated_text: generated_text?.trim() || null,
        created_by: userId,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert failed:", dbError);
      // Clean up R2 storage on database error
      try {
        await deleteFromR2(storagePath, "pathology-bites-audio");
      } catch (cleanupError) {
        console.error("Failed to cleanup R2 after database error:", cleanupError);
      }
      uploadedStoragePath = null;
      return NextResponse.json(
        { error: `Failed to save audio metadata: ${dbError.message}` },
        { status: 500 }
      );
    }

    uploadedStoragePath = null;

    return NextResponse.json({
      success: true,
      audio: audioData,
    });
  } catch (error) {
    console.error("Audio upload error:", error);

    if (uploadedStoragePath) {
      try {
        await deleteFromR2(uploadedStoragePath, "pathology-bites-audio");
      } catch (cleanupError) {
        console.error("Failed to cleanup R2 audio file:", cleanupError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Upload failed: ${errorMessage}` }, { status: 500 });
  }
}
