import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { deleteFromR2 } from "@/shared/services/r2-storage";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

// Audio lives in its own bucket (see admin/audio/upload). Deleting only the
// `audio` row — what the admin dialog used to do from the browser — left every
// deleted track behind in R2.
const AUDIO_BUCKET = "pathology-bites-audio";

const deleteAudioSchema = z.object({
  audioId: z.string().uuid(),
});

/**
 * @swagger
 * /api/admin/audio/delete:
 *   delete:
 *     summary: Delete an audio file
 *     description: Deletes an audio track's file from R2 storage and its row from the audio table. Requires admin role.
 *     tags:
 *       - Admin - Audio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - audioId
 *             properties:
 *               audioId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Audio deleted
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 *       404:
 *         description: Audio not found
 *       500:
 *         description: Database deletion failed
 */
export async function DELETE(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await parseBody(request, deleteAudioSchema);
    if (body instanceof NextResponse) return body;
    const { audioId } = body;

    const supabase = await createClient();
    const { data: audio, error: fetchError } = await supabase
      .from("audio")
      .select("id, storage_path")
      .eq("id", audioId)
      .maybeSingle();

    if (fetchError) {
      log.error("Failed to look up audio:", fetchError);
      return NextResponse.json({ error: "Failed to look up audio" }, { status: 500 });
    }
    if (!audio) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    // Storage first, but never let a storage failure keep the row: an orphaned
    // file is cheaper than a row pointing at nothing.
    let storageDeleted = false;
    if (audio.storage_path) {
      try {
        await deleteFromR2(audio.storage_path, AUDIO_BUCKET);
        storageDeleted = true;
      } catch (storageError) {
        log.warn("R2 audio deletion failed (continuing with database deletion):", storageError);
      }
    }

    const { error: dbError } = await supabase.from("audio").delete().eq("id", audioId);
    if (dbError) {
      log.error("Failed to delete audio row:", dbError);
      return NextResponse.json({ error: "Failed to delete audio" }, { status: 500 });
    }

    return NextResponse.json({ success: true, storageDeleted });
  } catch (error) {
    log.error("Audio deletion error:", error);
    return NextResponse.json({ error: "Failed to delete audio" }, { status: 500 });
  }
}
